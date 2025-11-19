#!/usr/bin/env python3
"""Generate a PDF with customer loyalty engagement statistics for admins."""

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
    parser = argparse.ArgumentParser(description='Render loyalty engagement report for admins.')
    parser.add_argument('--from', dest='start_date', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--to', dest='end_date', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output', help='Optional output path for the PDF.')
    return parser.parse_args()


def fetch_monthly_loyalty(cursor, start_date: str, end_date: str) -> List[Dict[str, Any]]:
    cursor.execute("""
        SELECT DATE_FORMAT(o.order_date, '%Y-%m-01') AS month_start,
               SUM(o.loyalty_points_used) AS points_redeemed,
               SUM(GREATEST(FLOOR((inv.price * o.quantity - IFNULL(o.loyalty_points_used, 0)) / 100), 0)) AS points_earned,
               COUNT(o.order_id) AS orders_count,
               SUM(inv.price * o.quantity) AS gross_sales
        FROM Orders AS o
        JOIN Inventory AS inv ON o.batch_id = inv.batch_id
        WHERE o.order_date BETWEEN %s AND %s
        GROUP BY month_start
        ORDER BY month_start ASC
    """, (start_date, end_date))
    return list(cursor.fetchall())


def safe_number(value: Any, fallback: str = '0') -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number.is_integer():
        return f'{int(number)}'
    return f'{number:.1f}'


def build_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        'pointsEarned': sum(row.get('points_earned') or 0 for row in rows),
        'pointsRedeemed': sum(row.get('points_redeemed') or 0 for row in rows),
        'netPoints': sum((row.get('points_earned') or 0) - (row.get('points_redeemed') or 0) for row in rows),
        'orders': sum(row.get('orders_count') or 0 for row in rows),
        'months': len(rows)
    }


def format_month(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value)
        return dt.strftime('%b %Y')
    except ValueError:
        return value or 'Unknown'


def page_hero(pdf: PdfPages, filters: Dict[str, str], summary: Dict[str, Any]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.tight_layout()
    fig.text(0.1, 0.95, 'Customer Loyalty Engagement', fontsize=18, weight='bold')
    fig.text(0.1, 0.92, f"Window: {filters.get('startDateFrom', '—')} → {filters.get('startDateTo', '—')}", fontsize=12)
    highlights = [
        ('Points earned', safe_number(summary.get('pointsEarned'))),
        ('Points redeemed', safe_number(summary.get('pointsRedeemed'))),
        ('Net change', safe_number(summary.get('netPoints'))),
        ('Orders analysed', safe_number(summary.get('orders')))
    ]
    y = 0.82
    for label, value in highlights:
        fig.text(0.1, y, label, fontsize=11, color='#6b5b53')
        fig.text(0.1, y - 0.02, value, fontsize=16, weight='bold')
        y -= 0.08
    pdf.savefig(fig)
    plt.close(fig)


def page_charts(pdf: PdfPages, rows: List[Dict[str, Any]]):
    if not rows:
        fig = plt.figure(figsize=(8.5, 11))
        fig.text(0.3, 0.5, 'No loyalty activity in this window.', fontsize=14, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return
    labels = [format_month(row.get('month_start') or '') for row in rows]
    earned = [row.get('points_earned') or 0 for row in rows]
    redeemed = [row.get('points_redeemed') or 0 for row in rows]
    fig, axes = plt.subplots(2, 1, figsize=(8.5, 11))
    fig.subplots_adjust(hspace=0.45)

    axes[0].bar(labels, earned, color='#0f8b6d', label='Earned')
    axes[0].bar(labels, redeemed, color='#d9594c', label='Redeemed', bottom=earned)
    axes[0].set_title('Points earned vs redeemed per month')
    axes[0].tick_params(axis='x', rotation=45)
    axes[0].legend()

    net = [e - r for e, r in zip(earned, redeemed)]
    axes[1].bar(labels, net, color='#4a5568')
    axes[1].set_title('Net loyalty point change')
    axes[1].tick_params(axis='x', rotation=45)

    pdf.savefig(fig)
    plt.close(fig)


def page_table(pdf: PdfPages, rows: List[Dict[str, Any]]):
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.05, right=0.95, top=0.9)
    ax = fig.add_subplot(111)
    ax.axis('off')
    columns = [
        'Month',
        'Points earned',
        'Avg earned/order',
        'Points redeemed',
        'Avg redeemed/order',
        'Orders'
    ]
    table_data = []
    for row in rows:
        orders = row.get('orders_count') or 0
        earned_avg = ((row.get('points_earned') or 0) / orders) if orders else 0
        redeemed_avg = ((row.get('points_redeemed') or 0) / orders) if orders else 0
        table_data.append([
            format_month(row.get('month_start') or ''),
            safe_number(row.get('points_earned')),
            safe_number(earned_avg),
            safe_number(row.get('points_redeemed')),
            safe_number(redeemed_avg),
            safe_number(orders)
        ])
    table = ax.table(cellText=table_data, colLabels=columns, loc='center', cellLoc='center')
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
        rows = fetch_monthly_loyalty(cursor, args.start_date, args.end_date)
    finally:
        conn.close()
    summary = build_summary(rows)

    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"admin-loyalty-report-{args.start_date}-{args.end_date}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(output_path) as pdf:
        page_hero(pdf, filters, summary)
        page_charts(pdf, rows)
        page_table(pdf, rows)
    print(json.dumps({
        'path': str(output_path.resolve()),
        'publicUrl': f"/reports/{output_path.name}"
    }))


if __name__ == '__main__':
    main()
