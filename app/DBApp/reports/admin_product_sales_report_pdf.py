#!/usr/bin/env python3
"""Generate a PDF showing product sales per type across all farms."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

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
    parser = argparse.ArgumentParser(description='Render product sales report by product type.')
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
        return '₱0.00'
    return f'₱{number:,.2f}'


def format_month(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value)
        return dt.strftime('%b %Y')
    except ValueError:
        return value or 'Unknown'


def fetch_monthly_product_sales(cursor, start_date: str, end_date: str):
    cursor.execute("""
        SELECT DATE_FORMAT(o.order_date, '%Y-%m-01') AS month_start,
               COALESCE(rp.product_type, 'Uncategorized') AS product_type,
               SUM(o.quantity) AS total_quantity,
               SUM(o.quantity * inv.price) AS total_revenue
        FROM Orders AS o
        JOIN Inventory AS inv ON o.batch_id = inv.batch_id
        JOIN RawProduct AS rp ON inv.product_id = rp.product_id
        WHERE o.order_date BETWEEN %s AND %s
        GROUP BY month_start, product_type
        ORDER BY month_start ASC, product_type ASC
    """, (start_date, end_date))
    return cursor.fetchall()


def build_sales_dataset(rows: List[Dict[str, Any]], months: List[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, float]], List[str]]:
    month_entries: Dict[str, Dict[str, Any]] = {
        month: {
            'month': month,
            'totalQuantity': 0.0,
            'totalRevenue': 0.0,
            'types': {}
        } for month in months
    }
    type_totals: Dict[str, Dict[str, float]] = {}
    for row in rows:
        month = row.get('month_start')
        if not month or month not in month_entries:
            continue
        product_type = row.get('product_type') or 'Uncategorized'
        qty = float(row.get('total_quantity') or 0)
        revenue = float(row.get('total_revenue') or 0)

        entry = month_entries[month]
        entry['totalQuantity'] += qty
        entry['totalRevenue'] += revenue
        type_entry = entry['types'].setdefault(product_type, {'quantity': 0.0, 'revenue': 0.0})
        type_entry['quantity'] += qty
        type_entry['revenue'] += revenue

        totals_entry = type_totals.setdefault(product_type, {'quantity': 0.0, 'revenue': 0.0})
        totals_entry['quantity'] += qty
        totals_entry['revenue'] += revenue

    ordered_months = [month_entries[month] for month in months]
    ordered_types = sorted(type_totals.keys(), key=lambda name: type_totals[name]['revenue'], reverse=True)
    return ordered_months, type_totals, ordered_types


def build_summary(month_entries: List[Dict[str, Any]], type_totals: Dict[str, Dict[str, float]], ordered_types: List[str]) -> Dict[str, Any]:
    total_revenue = sum(entry['totalRevenue'] for entry in month_entries)
    total_quantity = sum(entry['totalQuantity'] for entry in month_entries)
    top_type = ordered_types[0] if ordered_types else None
    bottom_type = ordered_types[-1] if ordered_types else None
    return {
        'totalRevenue': total_revenue,
        'totalQuantity': total_quantity,
        'productTypeCount': len(ordered_types),
        'topRevenueType': {
            'name': top_type,
            'value': type_totals.get(top_type, {}).get('revenue', 0) if top_type else 0
        } if top_type else None,
        'topQuantityType': {
            'name': max(ordered_types, key=lambda name: type_totals[name]['quantity']) if ordered_types else None,
            'value': max((type_totals[name]['quantity'] for name in ordered_types), default=0)
        } if ordered_types else None,
        'slowType': {
            'name': bottom_type,
            'value': type_totals.get(bottom_type, {}).get('revenue', 0) if bottom_type else 0
        } if bottom_type else None
    }


def page_hero(pdf: PdfPages, filters: Dict[str, str], summary: Dict[str, Any]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.tight_layout()
    fig.text(0.1, 0.95, 'Product sales overview', fontsize=18, weight='bold')
    fig.text(0.1, 0.92, f"Window: {filters.get('startDateFrom', '—')} → {filters.get('startDateTo', '—')}", fontsize=12)
    highlights = [
        ('Revenue captured', safe_currency(summary.get('totalRevenue'))),
        ('Units sold', safe_number(summary.get('totalQuantity'))),
        ('Product types active', safe_number(summary.get('productTypeCount'))),
        (
            'Top revenue type',
            (summary.get('topRevenueType', {}).get('name') or '—')
        )
    ]
    y = 0.8
    for label, value in highlights:
        fig.text(0.1, y, label, fontsize=11, color='#6b5b53')
        fig.text(0.1, y - 0.02, value or '—', fontsize=16, weight='bold')
        y -= 0.08
    pdf.savefig(fig)
    plt.close(fig)


def page_charts(pdf: PdfPages, month_entries: List[Dict[str, Any]], ordered_types: List[str], type_totals: Dict[str, Dict[str, float]]):
    if not month_entries:
        fig = plt.figure(figsize=(8.5, 11))
        fig.text(0.3, 0.5, 'No sales in this window.', fontsize=14, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return
    month_labels = [format_month(entry['month']) for entry in month_entries]
    fig = plt.figure(figsize=(8.5, 11))
    gs = fig.add_gridspec(3, 1, height_ratios=[1, 1, 1.2])
    ax_qty = fig.add_subplot(gs[0])
    ax_rev = fig.add_subplot(gs[1])
    ax_pie = fig.add_subplot(gs[2])

    total_qty = sum(entry['totalQuantity'] for entry in month_entries)
    total_rev = sum(entry['totalRevenue'] for entry in month_entries)

    if total_qty > 0 and ordered_types:
        bottom = [0.0] * len(month_entries)
        for product_type in ordered_types:
            values = [
                entry['types'].get(product_type, {}).get('quantity', 0.0)
                for entry in month_entries
            ]
            ax_qty.bar(month_labels, values, bottom=bottom, label=product_type)
            bottom = [b + v for b, v in zip(bottom, values)]
        ax_qty.set_title('Units sold per month (stacked by type)')
        ax_qty.tick_params(axis='x', rotation=45)
        ax_qty.legend(fontsize=8, loc='upper right', ncol=2)
    else:
        ax_qty.text(0.2, 0.5, 'No unit sales by product type.', fontsize=11, color='#6b5b53')
        ax_qty.axis('off')

    if total_rev > 0 and ordered_types:
        bottom = [0.0] * len(month_entries)
        for product_type in ordered_types:
            values = [
                entry['types'].get(product_type, {}).get('revenue', 0.0)
                for entry in month_entries
            ]
            ax_rev.bar(month_labels, values, bottom=bottom, label=product_type)
            bottom = [b + v for b, v in zip(bottom, values)]
        ax_rev.set_title('Revenue per month (stacked by type)')
        ax_rev.tick_params(axis='x', rotation=45)
    else:
        ax_rev.text(0.2, 0.5, 'No revenue captured in this window.', fontsize=11, color='#6b5b53')
        ax_rev.axis('off')

    pie_values = [type_totals[name]['revenue'] for name in ordered_types]
    if pie_values and sum(pie_values) > 0:
        ax_pie.pie(pie_values, labels=ordered_types, autopct='%1.1f%%', startangle=140)
        ax_pie.set_title('Revenue contribution by product type')
        ax_pie.axis('equal')
    else:
        ax_pie.text(0.25, 0.5, 'No yearly revenue contribution data.', fontsize=11, color='#6b5b53')
        ax_pie.axis('off')

    fig.tight_layout()
    pdf.savefig(fig)
    plt.close(fig)


def page_table(pdf: PdfPages, month_entries: List[Dict[str, Any]], ordered_types: List[str]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.05, right=0.95, top=0.9)
    ax = fig.add_subplot(111)
    ax.axis('off')
    if not ordered_types:
        ax.text(0.25, 0.5, 'No product types recorded for this window.', fontsize=12, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return
    columns = ['Product type'] + [format_month(entry['month']) for entry in month_entries]
    table_data: List[List[str]] = []
    for product_type in ordered_types:
        row = [product_type]
        for entry in month_entries:
            info = entry['types'].get(product_type)
            if info and info['revenue'] > 0:
                cell = safe_currency(info['revenue'])
            else:
                cell = '—'
            row.append(cell)
        table_data.append(row)
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
        rows = fetch_monthly_product_sales(cursor, args.start_date, args.end_date)
    finally:
        conn.close()
    month_entries, type_totals, ordered_types = build_sales_dataset(rows, months)
    summary = build_summary(month_entries, type_totals, ordered_types)
    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"admin-product-sales-report-{args.start_date}-{args.end_date}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(output_path) as pdf:
        page_hero(pdf, filters, summary)
        page_charts(pdf, month_entries, ordered_types, type_totals)
        page_table(pdf, month_entries, ordered_types)
    print(json.dumps({
        'path': str(output_path.resolve()),
        'publicUrl': f"/reports/{output_path.name}"
    }))


if __name__ == '__main__':
    main()
