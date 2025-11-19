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


def count_months(start_date: str, end_date: str) -> int:
    try:
        start = datetime.fromisoformat(start_date).replace(day=1)
        end = datetime.fromisoformat(end_date).replace(day=1)
    except ValueError:
        return 1
    months = (end.year - start.year) * 12 + (end.month - start.month) + 1
    return max(months, 1)


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
        ('Avg monthly revenue', safe_currency(summary.get('avgMonthlyRevenue')))
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


def page_table(pdf: PdfPages, products: List[Dict[str, Any]]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.05, right=0.95, top=0.92)
    ax = fig.add_subplot(111)
    ax.axis('off')
    columns = ['Product', 'Orders', 'Units', 'Revenue']
    rows = []
    for item in products:
        rows.append([
            item.get('product_name') or 'Product',
            safe_number(item.get('orders_count')),
            safe_number(item.get('total_quantity')),
            safe_currency(item.get('total_revenue'))
        ])
    table = ax.table(cellText=rows, colLabels=columns, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.2)
    pdf.savefig(fig)
    plt.close(fig)


def main():
    args = parse_args()
    filters = {
        'startDateFrom': args.start_date,
        'startDateTo': args.end_date
    }
    conn = connect_db()
    try:
        cursor = conn.cursor(dictionary=True)
        farm = fetch_farm(cursor, args.farm_id)
        if not farm:
            raise SystemExit('Farm not found.')
        products = fetch_order_breakdown(cursor, args.farm_id, args.start_date, args.end_date)
    finally:
        conn.close()
    months_tracked = count_months(args.start_date, args.end_date)
    total_orders = sum(item.get('orders_count') or 0 for item in products)
    total_quantity = sum(item.get('total_quantity') or 0 for item in products)
    total_revenue = sum(item.get('total_revenue') or 0 for item in products)
    summary = {
        'totalOrders': total_orders,
        'totalQuantity': total_quantity,
        'totalRevenue': total_revenue,
        'productCount': len(products),
        'avgMonthlyRevenue': (total_revenue / months_tracked) if months_tracked else 0,
        'monthsTracked': months_tracked
    }
    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"order-sales-report-{args.farm_id}-{args.start_date}-{args.end_date}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(output_path) as pdf:
        page_hero(pdf, farm, filters, summary)
        page_charts(pdf, products)
        page_table(pdf, products)
    print(json.dumps({
        'path': str(output_path.resolve()),
        'publicUrl': f"/reports/{output_path.name}"
    }))


if __name__ == '__main__':
    main()
