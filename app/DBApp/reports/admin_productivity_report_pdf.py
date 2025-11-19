#!/usr/bin/env python3
"""Generate a productivity report comparing farm product populations against inventory."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import matplotlib.pyplot as plt
import mysql.connector
from matplotlib.backends.backend_pdf import PdfPages

CONFIG_PATH = Path(__file__).resolve().parents[1] / 'config' / 'database.json'
FRONTEND_REPORTS_DIR = Path(__file__).resolve().parents[3] / 'frontend' / 'reports'


def load_db_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise SystemExit(f'Missing database config at {CONFIG_PATH}')
    data = json.loads(CONFIG_PATH.read_text())
    connection = data.get('connection', {})
    return {
        'host': connection.get('host', '127.0.0.1'),
        'port': connection.get('port', 3306),
        'user': connection.get('user', 'root'),
        'password': connection.get('password', ''),
        'database': connection.get('database')
    }


def connect_db():
    params = load_db_config()
    if not params['database']:
        raise SystemExit('Database name is missing from config.')
    try:
        return mysql.connector.connect(**params)
    except mysql.connector.Error as exc:
        raise SystemExit(f"Unable to connect to the database: {exc}") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Render farm productivity PDF for admins.')
    parser.add_argument('--from', dest='start_date', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--to', dest='end_date', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output', help='Optional output path for the PDF.')
    return parser.parse_args()


def month_range(start_date: str, end_date: str) -> List[str]:
    months: List[str] = []
    current = datetime.fromisoformat(start_date).replace(day=1)
    end = datetime.fromisoformat(end_date).replace(day=1)
    while current <= end:
        months.append(current.strftime('%Y-%m-01'))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    return months


def format_month_label(month: str) -> str:
    try:
        dt = datetime.fromisoformat(month)
        return dt.strftime('%b %Y')
    except ValueError:
        return month or 'Unknown'


def safe_number(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return '0'
    if number.is_integer():
        return f'{int(number)}'
    return f'{number:.1f}'


def fetch_product_farms(cursor):
    cursor.execute("""
        SELECT fp.product_id,
               rp.product_name,
               rp.product_type,
               rp.grade,
               fp.farm_id,
               fp.population,
               f.name AS farm_name
        FROM FarmProduct AS fp
        JOIN RawProduct AS rp ON fp.product_id = rp.product_id
        LEFT JOIN Farm AS f ON fp.farm_id = f.farm_id
    """)
    return cursor.fetchall()


def fetch_inventory_per_product(cursor, start_date: str, end_date: str):
    cursor.execute("""
        SELECT inv.product_id,
               inv.farm_id,
               DATE_FORMAT(inv.exp_date, '%Y-%m-01') AS month_start,
               SUM(inv.quantity) AS total_quantity
        FROM Inventory AS inv
        WHERE inv.exp_date BETWEEN %s AND %s
        GROUP BY inv.product_id, inv.farm_id, month_start
    """, (start_date, end_date))
    return cursor.fetchall()


def fetch_sales_per_product(cursor, start_date: str, end_date: str):
    cursor.execute("""
        SELECT rp.product_id,
               DATE_FORMAT(o.order_date, '%Y-%m-01') AS month_start,
               SUM(o.quantity) AS total_quantity,
               SUM(o.quantity * inv.price) AS total_revenue
        FROM Orders AS o
        JOIN Inventory AS inv ON o.batch_id = inv.batch_id
        JOIN RawProduct AS rp ON inv.product_id = rp.product_id
        WHERE o.order_date BETWEEN %s AND %s
        GROUP BY rp.product_id, month_start
    """, (start_date, end_date))
    return cursor.fetchall()


def build_product_dataset(product_rows, inventory_rows, sales_rows, months: List[str]):
    products: Dict[str, Dict[str, Any]] = {}
    product_lookup: Dict[int, str] = {}
    for row in product_rows:
        base_name = row.get('product_name') or f"Product #{row['product_id']}"
        type_name = row.get('product_type') or 'Uncategorized'
        key = f"{base_name}|{type_name}"
        product_lookup[row['product_id']] = key
        product = products.setdefault(key, {
            'productId': key,
            'name': base_name,
            'type': type_name,
            'farms': {},
            'months': {
                month: {
                    'farmProductivity': {},
                    'avgProductivity': 0.0,
                    'salesQty': 0.0,
                    'salesRevenue': 0.0,
                    'best': None,
                    'low': None
                } for month in months
            },
            'totalSalesQty': 0.0,
            'totalSalesRevenue': 0.0
        })
        farm_id = row['farm_id']
        farm = product['farms'].setdefault(farm_id, {
            'population': 0.0,
            'name': row.get('farm_name') or f"Farm #{farm_id}"
        })
        farm['population'] += float(row.get('population') or 0)

    for row in inventory_rows:
        key = product_lookup.get(row['product_id'])
        if not key:
            continue
        product = products.get(key)
        if not product:
            continue
        month = row.get('month_start')
        if month not in product['months']:
            continue
        farm_id = row['farm_id']
        population = product['farms'].get(farm_id, {}).get('population', 0)
        if population:
            productivity = float(row.get('total_quantity') or 0) / population
            product['months'][month]['farmProductivity'][farm_id] = {
                'value': productivity,
                'name': product['farms'].get(farm_id, {}).get('name')
            }

    for row in sales_rows:
        key = product_lookup.get(row['product_id'])
        if not key:
            continue
        product = products.get(key)
        if not product:
            continue
        month = row.get('month_start')
        if month not in product['months']:
            continue
        qty = float(row.get('total_quantity') or 0)
        revenue = float(row.get('total_revenue') or 0)
        product['months'][month]['salesQty'] += qty
        product['months'][month]['salesRevenue'] += revenue
        product['totalSalesQty'] += qty
        product['totalSalesRevenue'] += revenue

    dataset = []
    for product in products.values():
        for month in months:
            entry = product['months'][month]
            values = list(entry['farmProductivity'].values())
            if values:
                avg = sum(item['value'] for item in values) / len(values)
                entry['avgProductivity'] = avg
                entry['best'] = max(values, key=lambda item: item['value'])
                entry['low'] = min(values, key=lambda item: item['value'])
        dataset.append(product)

    dataset.sort(key=lambda item: item['name'])
    return dataset


def average_productivity(product: Dict[str, Any], months: List[str]) -> float:
    values = [
        product['months'][month]['avgProductivity']
        for month in months
        if product['months'][month]['avgProductivity']
    ]
    if not values:
        return 0.0
    return sum(values) / len(values)


def build_summary(products: List[Dict[str, Any]], months: List[str]) -> Dict[str, Any]:
    if not products:
        return {
            'totalProducts': 0,
            'avgProductivity': 0,
            'topProduct': None,
            'lowProduct': None,
            'topSalesProduct': None
        }
    top_product = max(products, key=lambda product: average_productivity(product, months))
    low_product = min(products, key=lambda product: average_productivity(product, months))
    top_sales = max(products, key=lambda item: item['totalSalesQty'], default=top_product)
    overall_avg = sum(average_productivity(product, months) for product in products) / len(products)
    return {
        'totalProducts': len(products),
        'avgProductivity': overall_avg,
        'topProduct': {'name': top_product['name'], 'value': average_productivity(top_product, months)},
        'lowProduct': {'name': low_product['name'], 'value': average_productivity(low_product, months)},
        'topSalesProduct': top_sales['name'] if top_sales else None
    }


def page_hero(pdf: PdfPages, filters: Dict[str, str], summary: Dict[str, Any]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.tight_layout()
    fig.text(0.1, 0.95, 'Productivity vs Inventory (product view)', fontsize=18, weight='bold')
    fig.text(0.1, 0.92, f"Window: {filters.get('startDateFrom', '—')} → {filters.get('startDateTo', '—')}", fontsize=12)
    highlights = [
        ('Products analysed', safe_number(summary.get('totalProducts'))),
        ('Average productivity', safe_number(summary.get('avgProductivity'))),
        (
            'Top performer',
            f"{summary['topProduct']['name']} ({safe_number(summary['topProduct']['value'])})"
            if summary.get('topProduct') else '—'
        ),
        (
            'Needs support',
            f"{summary['lowProduct']['name']} ({safe_number(summary['lowProduct']['value'])})"
            if summary.get('lowProduct') else '—'
        ),
        ('Top seller', summary.get('topSalesProduct') or '—')
    ]
    y = 0.8
    for label, value in highlights:
        fig.text(0.1, y, label, fontsize=11, color='#6b5b53')
        fig.text(0.1, y - 0.02, value or '—', fontsize=15, weight='bold')
        y -= 0.07
    pdf.savefig(fig)
    plt.close(fig)


def month_average_productivity(products: List[Dict[str, Any]], month: str) -> float:
    values = [
        product['months'][month]['avgProductivity']
        for product in products
        if product['months'][month]['avgProductivity']
    ]
    if not values:
        return 0.0
    return sum(values) / len(values)


def page_charts(pdf: PdfPages, products: List[Dict[str, Any]], months: List[str]):
    if not products:
        fig = plt.figure(figsize=(8.5, 11))
        fig.text(0.3, 0.5, 'No productivity data available for the selected window.', fontsize=14, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return

    month_labels = [format_month_label(month) for month in months]
    top_products = sorted(products, key=lambda item: average_productivity(item, months), reverse=True)[:5]

    fig, axes = plt.subplots(2, 1, figsize=(8.5, 11))
    fig.subplots_adjust(hspace=0.45)

    for product in top_products:
        series = [product['months'][month]['avgProductivity'] or 0 for month in months]
        axes[0].plot(month_labels, series, marker='o', label=product['name'])
    axes[0].set_title('Average productivity per product (top 5)')
    axes[0].set_ylabel('Inventory ÷ population')
    axes[0].tick_params(axis='x', rotation=45)
    axes[0].grid(alpha=0.2)
    if top_products:
        axes[0].legend(loc='upper left', fontsize=8)

    sales_qty = [sum(product['months'][month]['salesQty'] for product in products) for month in months]
    avg_prod = [month_average_productivity(products, month) for month in months]
    axes[1].bar(month_labels, sales_qty, color='#4a90e2', label='Units sold')
    axes[1].set_title('Productivity vs sales volume per month')
    axes[1].set_ylabel('Units sold')
    axes[1].tick_params(axis='x', rotation=45)
    axes[1].grid(axis='y', alpha=0.2)

    ax2 = axes[1].twinx()
    ax2.plot(month_labels, avg_prod, color='#d65745', marker='o', label='Average productivity')
    ax2.set_ylabel('Avg productivity')

    lines, labels = axes[1].get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    axes[1].legend(lines + lines2, labels + labels2, loc='upper left', fontsize=8)

    pdf.savefig(fig)
    plt.close(fig)


def summarize_farm_performance(product: Dict[str, Any]):
    stats: Dict[int, Dict[str, Any]] = {}
    for entry in product['months'].values():
        for farm_id, info in entry['farmProductivity'].items():
            record = stats.setdefault(farm_id, {'name': info['name'], 'values': []})
            record['values'].append(info['value'])
    best = None
    worst = None
    for record in stats.values():
        if not record['values']:
            continue
        avg_value = sum(record['values']) / len(record['values'])
        payload = {'name': record['name'], 'avg': avg_value}
        if not best or avg_value > best['avg']:
            best = payload
        if not worst or avg_value < worst['avg']:
            worst = payload
    return best, worst


def page_table(pdf: PdfPages, products: List[Dict[str, Any]], months: List[str]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.05, right=0.97, top=0.92)
    ax = fig.add_subplot(111)
    ax.axis('off')
    columns = ['Product', 'Best performing farm', 'Needs support']
    table_data = []
    for product in products:
        label = f"{product['name']} ({product.get('type') or 'Type'})"
        best, worst = summarize_farm_performance(product)
        best_text = f"{best['name']} ({safe_number(best['avg'])})" if best else '—'
        worst_text = f"{worst['name']} ({safe_number(worst['avg'])})" if worst else '—'
        table_data.append([label, best_text, worst_text])

    table = ax.table(cellText=table_data, colLabels=columns, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(7)
    table.scale(1, 1.2)
    pdf.savefig(fig)
    plt.close(fig)


def main():
    args = parse_args()
    filters = {
        'startDateFrom': args.start_date,
        'startDateTo': args.end_date
    }
    months = month_range(args.start_date, args.end_date)
    conn = connect_db()
    try:
        cursor = conn.cursor(dictionary=True)
        product_rows = fetch_product_farms(cursor)
        inventory_rows = fetch_inventory_per_product(cursor, args.start_date, args.end_date)
        sales_rows = fetch_sales_per_product(cursor, args.start_date, args.end_date)
    finally:
        conn.close()

    dataset = build_product_dataset(product_rows, inventory_rows, sales_rows, months)
    summary = build_summary(dataset, months)

    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"admin-productivity-report-{args.start_date}-{args.end_date}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(output_path) as pdf:
        page_hero(pdf, filters, summary)
        page_charts(pdf, dataset, months)
        page_table(pdf, dataset, months)
    print(json.dumps({
        'path': str(output_path.resolve()),
        'publicUrl': f"/reports/{output_path.name}"
    }))


if __name__ == '__main__':
    main()
