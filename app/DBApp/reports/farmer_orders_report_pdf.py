#!/usr/bin/env python3
"""Render a PDF showing on-demand order sales per product offering."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

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
    parser = argparse.ArgumentParser(description='Render on-demand sales report for a farm.')
    parser.add_argument('--farm-id', type=int, required=True)
    parser.add_argument('--from', dest='start_date', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--to', dest='end_date', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output', help='Optional output path for the PDF.')
    return parser.parse_args()


def fetch_farm(cursor, farm_id: int) -> Optional[Dict[str, Any]]:
    cursor.execute("""
        SELECT f.farm_id, f.name as farm_name, loc.street, loc.city, loc.state, loc.country
        FROM Farm AS f
        LEFT JOIN Location AS loc ON f.location_id = loc.location_id
        WHERE f.farm_id = %s
    """, (farm_id,))
    row = cursor.fetchone()
    if not row:
        return None
    parts = [row.get('street'), row.get('city'), row.get('state'), row.get('country')]
    return {
        'farmId': row['farm_id'],
        'name': row.get('farm_name'),
        'locationLabel': ', '.join([part for part in parts if part]) or None
    }


def fetch_order_breakdown(cursor, farm_id: int, start_date: str, end_date: str):
    cursor.execute("""
        SELECT rp.product_id,
               rp.product_name,
               rp.product_type,
               rp.grade,
               SUM(o.quantity) AS total_quantity,
               SUM(o.quantity * inv.price) AS total_revenue,
               COUNT(o.order_id) AS orders_count
        FROM Orders AS o
        JOIN Inventory AS inv ON o.batch_id = inv.batch_id
        JOIN RawProduct AS rp ON inv.product_id = rp.product_id
        WHERE inv.farm_id = %s
          AND o.order_date BETWEEN %s AND %s
        GROUP BY rp.product_id, rp.product_name, rp.product_type, rp.grade
        ORDER BY total_quantity DESC
    """, (farm_id, start_date, end_date))
    return list(cursor.fetchall())


def fetch_monthly_order_breakdown(cursor, farm_id: int, start_date: str, end_date: str):
    cursor.execute("""
        SELECT rp.product_id,
               rp.product_name,
               rp.product_type,
               rp.grade,
               DATE_FORMAT(o.order_date, '%Y-%m-01') AS month_start,
               SUM(o.quantity) AS total_quantity,
               SUM(o.quantity * inv.price) AS total_revenue,
               COUNT(o.order_id) AS orders_count
        FROM Orders AS o
        JOIN Inventory AS inv ON o.batch_id = inv.batch_id
        JOIN RawProduct AS rp ON inv.product_id = rp.product_id
        WHERE inv.farm_id = %s
          AND o.order_date BETWEEN %s AND %s
        GROUP BY rp.product_id, rp.product_name, rp.product_type, rp.grade, month_start
        ORDER BY rp.product_name ASC, month_start ASC
    """, (farm_id, start_date, end_date))
    return list(cursor.fetchall())


def safe_number(value: Any, fallback: str = '0') -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number.is_integer():
        return f'{int(number)}'
    return f'{number:.1f}'


def safe_currency(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return '—'
    return f'₱{number:,.2f}'


def month_range(start_date: str, end_date: str) -> List[str]:
    months: List[str] = []
    try:
        current = datetime.fromisoformat(start_date).replace(day=1)
        end = datetime.fromisoformat(end_date).replace(day=1)
    except ValueError:
        return months
    while current <= end:
        months.append(current.strftime('%Y-%m-01'))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    return months or [start_date]


def format_month_label(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value)
        return dt.strftime('%b %Y')
    except ValueError:
        return value or '—'


def build_monthly_dataset(products: List[Dict[str, Any]], monthly_rows: List[Dict[str, Any]], months: List[str]):
    template = {month: {'quantity': 0.0, 'revenue': 0.0, 'orders': 0} for month in months}
    dataset: Dict[int, Dict[str, Any]] = {}
    for product in products:
        dataset[product['product_id']] = {
            'product': product,
            'months': {month: template[month].copy() for month in months}
        }
    for row in monthly_rows:
        product_id = row['product_id']
        entry = dataset.setdefault(product_id, {
            'product': {
                'product_id': product_id,
                'product_name': row.get('product_name') or f"Product #{product_id}",
                'product_type': row.get('product_type'),
                'grade': row.get('grade')
            },
            'months': {month: template[month].copy() for month in months}
        })
        month = row.get('month_start')
        if month not in entry['months']:
            continue
        bucket = entry['months'][month]
        bucket['quantity'] += float(row.get('total_quantity') or 0)
        bucket['revenue'] += float(row.get('total_revenue') or 0)
        bucket['orders'] += int(row.get('orders_count') or 0)
    return dataset


def build_summary_text(filters: Dict[str, Any]) -> str:
    return f"Window: {filters.get('startDateFrom', '—')} → {filters.get('startDateTo', '—')}"


def page_hero(pdf: PdfPages, farm: Dict[str, Any], filters: Dict[str, Any], summary: Dict[str, Any]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.tight_layout()
    fig.text(0.1, 0.95, f"On-demand Sales · Farm #{farm.get('farmId', '—')}", fontsize=18, weight='bold')
    fig.text(0.1, 0.92, farm.get('name') or 'Farm details unavailable', fontsize=14)
    if farm.get('locationLabel'):
        fig.text(0.1, 0.89, farm['locationLabel'], fontsize=11, color='#6b5b53')
    fig.text(0.1, 0.85, build_summary_text(filters), fontsize=11)
    highlights = [
        ('Orders fulfilled', safe_number(summary.get('totalOrders'))),
        ('Units sold', safe_number(summary.get('totalQuantity'))),
        ('Products involved', safe_number(summary.get('productCount'))),
        ('Revenue captured', safe_currency(summary.get('totalRevenue')))
    ]
    y = 0.77
    for label, value in highlights:
        fig.text(0.1, y, label, fontsize=10, color='#6b5b53')
        fig.text(0.1, y - 0.02, value, fontsize=16, weight='bold')
        y -= 0.07
    pdf.savefig(fig)
    plt.close(fig)


def page_charts(pdf: PdfPages, products: List[Dict[str, Any]]):
    labels = [item.get('product_name') or 'Product' for item in products]
    quantities = [float(item.get('total_quantity') or 0) for item in products]
    revenues = [float(item.get('total_revenue') or 0) for item in products]
    fig, axes = plt.subplots(2, 1, figsize=(8.5, 11))
    fig.subplots_adjust(hspace=0.6)
    if sum(quantities) > 0:
        axes[0].pie(quantities, labels=labels, autopct='%1.1f%%', startangle=140)
        axes[0].set_title('Share of units sold')
        axes[0].axis('equal')
    else:
        axes[0].text(0.25, 0.5, 'No units sold in the selected window.', fontsize=12, color='#6b5b53')
        axes[0].axis('off')
    if sum(revenues) > 0:
        axes[1].pie(revenues, labels=labels, autopct='%1.1f%%', startangle=140)
        axes[1].set_title('Revenue contribution per product')
        axes[1].axis('equal')
    else:
        axes[1].text(0.25, 0.5, 'No revenue captured in the selected window.', fontsize=12, color='#6b5b53')
        axes[1].axis('off')
    pdf.savefig(fig)
    plt.close(fig)


def page_product_breakdowns(pdf: PdfPages, products: List[Dict[str, Any]], monthly_dataset: Dict[int, Dict[str, Any]], months: List[str]):
    if not products:
        fig = plt.figure(figsize=(8.5, 11))
        fig.text(0.3, 0.5, 'No products recorded for the selected window.', fontsize=13, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return
    month_labels = [format_month_label(month) for month in months]
    for product in products:
        data = monthly_dataset.get(product['product_id']) or {'months': {month: {'revenue': 0, 'quantity': 0, 'orders': 0} for month in months}}
        fig = plt.figure(figsize=(8.5, 11))
        fig.subplots_adjust(top=0.9)
        title = f"{product.get('product_name') or 'Product'} · {product.get('product_type') or 'Type'}"
        fig.suptitle(title, fontsize=16, weight='bold')
        gs = fig.add_gridspec(2, 1, height_ratios=[1, 1])
        ax_table = fig.add_subplot(gs[0])
        ax_chart = fig.add_subplot(gs[1])
        ax_table.axis('off')
        columns = ['Month', 'Orders', 'Units', 'Revenue']
        rows = []
        chart_values = []
        for month, label in zip(months, month_labels):
            entry = data['months'].get(month, {'orders': 0, 'quantity': 0, 'revenue': 0})
            rows.append([
                label,
                safe_number(entry.get('orders')),
                safe_number(entry.get('quantity')),
                safe_currency(entry.get('revenue'))
            ])
            chart_values.append(entry.get('revenue', 0))
        table = ax_table.table(cellText=rows, colLabels=columns, loc='center', cellLoc='center')
        table.auto_set_font_size(False)
        table.set_fontsize(9)
        table.scale(1, 1.2)
        ax_chart.plot(month_labels, chart_values, marker='o', color='#4a90e2')
        ax_chart.set_title('Monthly revenue trend')
        ax_chart.set_ylabel('Revenue (₱)')
        ax_chart.tick_params(axis='x', rotation=45)
        ax_chart.grid(alpha=0.2)
        pdf.savefig(fig)
        plt.close(fig)


def main():
    args = parse_args()
    filters = {
        'startDateFrom': args.start_date,
        'startDateTo': args.end_date
    }
    months = month_range(args.start_date, args.end_date)
    if not months:
        months = [args.start_date]
    conn = connect_db()
    try:
        cursor = conn.cursor(dictionary=True)
        farm = fetch_farm(cursor, args.farm_id)
        if not farm:
            raise SystemExit('Farm not found.')
        products = fetch_order_breakdown(cursor, args.farm_id, args.start_date, args.end_date)
        monthly_rows = fetch_monthly_order_breakdown(cursor, args.farm_id, args.start_date, args.end_date)
    finally:
        conn.close()
    total_orders = sum(item.get('orders_count') or 0 for item in products)
    total_quantity = sum(item.get('total_quantity') or 0 for item in products)
    total_revenue = sum(item.get('total_revenue') or 0 for item in products)
    summary = {
        'totalOrders': total_orders,
        'totalQuantity': total_quantity,
        'totalRevenue': total_revenue,
        'productCount': len(products)
    }
    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"order-sales-report-{args.farm_id}-{args.start_date}-{args.end_date}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    monthly_dataset = build_monthly_dataset(products, monthly_rows, months)
    with PdfPages(output_path) as pdf:
        page_hero(pdf, farm, filters, summary)
        page_charts(pdf, products)
        page_product_breakdowns(pdf, products, monthly_dataset, months)
    print(json.dumps({
        'path': str(output_path.resolve()),
        'publicUrl': f"/reports/{output_path.name}"
    }))


if __name__ == '__main__':
    main()
