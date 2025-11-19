#!/usr/bin/env python3
"""Render a farmer subscription report from the database and save it to PDF."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

import mysql.connector
import matplotlib.pyplot as plt
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Render a PDF report for a farmer.')
    parser.add_argument('--farm-id', type=int, required=True, help='ID of the farm.')
    parser.add_argument('--from', dest='start_date', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--to', dest='end_date', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--product-id', type=int, help='Optional product filter.')
    parser.add_argument('--output', help='Optional path for the resulting PDF.')
    return parser.parse_args()


def connect_db():
    params = load_db_config()
    if not params['database']:
        raise SystemExit('Database name is missing from config.')
    try:
        return mysql.connector.connect(**params)
    except mysql.connector.Error as exc:
        raise SystemExit(f"Unable to connect to the database: {exc}") from exc


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
    location = ', '.join([part for part in parts if part])
    return {
        'farmId': row['farm_id'],
        'name': row.get('farm_name'),
        'locationLabel': location or None
    }


def fetch_offerings(cursor, farm_id: int) -> List[Dict[str, Any]]:
    cursor.execute("""
        SELECT fp.product_id, rp.product_name, rp.product_type, rp.grade
        FROM FarmProduct AS fp
        JOIN RawProduct AS rp ON fp.product_id = rp.product_id
        WHERE fp.farm_id = %s
        ORDER BY rp.product_name
    """, (farm_id,))
    return list(cursor.fetchall())


def fetch_inventory(cursor, farm_id: int, product_id: Optional[int]) -> List[Dict[str, Any]]:
    sql = """
        SELECT inv.product_id, inv.price, inv.weight, inv.quantity
        FROM Inventory AS inv
        WHERE inv.farm_id = %s AND inv.price IS NOT NULL AND inv.weight IS NOT NULL AND inv.weight > 0
    """
    params: List[Any] = [farm_id]
    if product_id:
        sql += " AND inv.product_id = %s"
        params.append(product_id)
    cursor.execute(sql, tuple(params))
    return list(cursor.fetchall())


def fetch_subscriptions(cursor, farm_id: int, start_date: str, end_date: str, product_id: Optional[int]) -> List[Dict[str, Any]]:
    sql = """
    SELECT s.program_id, s.product_id, s.client_id, s.farm_id, s.order_interval_days,
           s.start_date, s.quantity, s.price, s.status,
           c.first_name, c.last_name, c.company_name,
           rp.product_name, rp.product_type, rp.grade
        FROM Subscription AS s
        JOIN Client AS c ON s.client_id = c.client_id
        JOIN RawProduct AS rp ON s.product_id = rp.product_id
        WHERE s.farm_id = %s
          AND s.start_date BETWEEN %s AND %s
    """
    params: List[Any] = [farm_id, start_date, end_date]
    if product_id:
        sql += " AND s.product_id = %s"
        params.append(product_id)
    sql += " ORDER BY rp.product_name, s.start_date"
    cursor.execute(sql, tuple(params))
    rows = cursor.fetchall()
    return [
        {
            'programId': row['program_id'],
            'productId': row['product_id'],
            'farmId': row['farm_id'],
            'clientId': row['client_id'],
            'clientName': ' '.join(filter(None, [row['first_name'], row['last_name']])).strip() or f"Client #{row['client_id']}",
            'companyName': row.get('company_name'),
            'startDate': row.get('start_date').isoformat() if row.get('start_date') else None,
            'quantity': row.get('quantity'),
            'intervalDays': row.get('order_interval_days'),
            'price': row.get('price'),
            'status': row.get('status'),
            'productName': row.get('product_name'),
            'productType': row.get('product_type'),
            'grade': row.get('grade')
        }
        for row in rows
    ]


def to_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (float, int)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def average(values: List[float]) -> Optional[float]:
    filtered = [value for value in values if value is not None]
    if not filtered:
        return None
    return round(sum(filtered) / len(filtered), 2)


def build_inventory_lookup(rows: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    lookup: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        pid = row['product_id']
        entry = lookup.setdefault(pid, {'unitPrices': [], 'availableUnits': 0})
        price = to_number(row.get('price'))
        weight = to_number(row.get('weight'))
        if price is not None and weight:
            entry['unitPrices'].append(price / weight)
        entry['availableUnits'] += row.get('quantity') or 0
    return {
        pid: {
            'avgPrice': to_number(average(values['unitPrices'])),
            'availableUnits': values['availableUnits']
        }
        for pid, values in lookup.items()
    }


STATUS_LABELS = {
    'ACTIVE': 'Active',
    'CANCELLED': 'Cancelled',
    'QUOTED': 'Quoted',
    'AWAITING_QUOTE': 'Awaiting quote'
}


def to_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, float):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_report(farm: Dict[str, Any], filters: Mapping[str, Any], offerings: List[Dict[str, Any]],
                 subscriptions: List[Dict[str, Any]], inventory_lookup: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    entry_map: Dict[int, Dict[str, Any]] = {}
    for offer in offerings:
        entry_map[offer['product_id']] = {
            'productId': offer['product_id'],
            'productName': offer['product_name'],
            'productType': offer['product_type'],
            'grade': offer['grade'],
            'subscriptions': [],
            'clientIds': set(),
            'activeCount': 0,
            'cancelledCount': 0,
            'awaitingCount': 0,
            'priceSamples': [],
            'intervalSamples': [],
            'quantitySamples': [],
            'monthlyRevenue': []
        }
    for sub in subscriptions:
        pid = sub['productId']
        entry = entry_map.setdefault(pid, {
            'productId': pid,
            'productName': sub['productName'],
            'productType': sub['productType'],
            'grade': sub['grade'],
            'subscriptions': [],
            'clientIds': set(),
            'activeCount': 0,
            'cancelledCount': 0,
            'awaitingCount': 0,
            'priceSamples': [],
            'intervalSamples': [],
            'quantitySamples': [],
            'monthlyRevenue': []
        })
        entry['subscriptions'].append(sub)
        entry['clientIds'].add(sub['clientId'])
        status = (sub['status'] or 'AWAITING_QUOTE').upper()
        if status == 'ACTIVE':
            entry['activeCount'] += 1
        elif status == 'CANCELLED':
            entry['cancelledCount'] += 1
        else:
            entry['awaitingCount'] += 1
        price = to_number(sub.get('price'))
        if price is not None:
            entry['priceSamples'].append(price)
        quantity = to_number(sub.get('quantity'))
        if quantity is not None:
            entry['quantitySamples'].append(quantity)
        interval_days = to_number(sub.get('intervalDays'))
        if interval_days and status == 'ACTIVE':
            entry['intervalSamples'].append(interval_days)
            if price is not None and interval_days > 0:
                units = quantity if quantity is not None else 1
                entry['monthlyRevenue'].append((30 / interval_days) * price * units)
    offerings_list = []
    for entry in entry_map.values():
        avg_subscription_price = average(entry['priceSamples'])
        avg_interval = average(entry['intervalSamples'])
        avg_quantity = average(entry['quantitySamples'])
        projected_monthly = sum(entry['monthlyRevenue'])
        inventory = inventory_lookup.get(entry['productId'], {})
        on_demand_price = to_number(inventory.get('avgPrice'))
        price_delta = None
        if avg_subscription_price is not None and on_demand_price is not None:
            price_delta = round(avg_subscription_price - on_demand_price, 2)
        total_programs = len(entry['subscriptions'])
        churn_rate = None
        denominator = entry['activeCount'] + entry['cancelledCount'] + entry['awaitingCount']
        if denominator:
            churn_rate = round(entry['cancelledCount'] / denominator * 100, 1)
        offerings_list.append({
            'productId': entry['productId'],
            'productName': entry['productName'],
            'productType': entry['productType'],
            'grade': entry['grade'],
            'activeCount': entry['activeCount'],
            'cancelledCount': entry['cancelledCount'],
            'awaitingCount': entry['awaitingCount'],
            'totalPrograms': total_programs,
            'uniqueClients': len(entry['clientIds']),
            'averageSubscriptionPrice': avg_subscription_price,
            'averageIntervalDays': avg_interval,
            'averageQuantity': avg_quantity,
            'projectedMonthlyRevenue': projected_monthly,
            'onDemandUnitPrice': on_demand_price,
            'priceDelta': price_delta,
            'priceDeltaPercent': round(price_delta / on_demand_price * 100, 1) if price_delta is not None and on_demand_price else None,
            'availableUnits': inventory.get('availableUnits', 0),
            'churnRate': churn_rate,
            'clients': [{
                'clientName': client['clientName'],
                'status': client['status'],
                'statusLabel': STATUS_LABELS.get((client['status'] or '').upper(), client['status'] or 'Unknown'),
                'quantity': client['quantity'],
                'intervalDays': client['intervalDays'],
                'price': client['price']
            } for client in entry['subscriptions']]
        })
    offerings_list.sort(key=lambda item: (-item['activeCount'], item['productName'] or ''))
    summary = {
        'totalPrograms': sum(item['totalPrograms'] for item in offerings_list),
        'uniqueClients': len({client['clientName'] for item in offerings_list for client in item['clients']}),
        'activePrograms': sum(item['activeCount'] for item in offerings_list),
        'cancelledPrograms': sum(item['cancelledCount'] for item in offerings_list),
        'offeringCoverage': len([item for item in offerings_list if item['totalPrograms'] > 0]),
        'reportWindow': {'from': filters.get('startDateFrom'), 'to': filters.get('startDateTo')}
    }
    chartData = {
        'labels': [item['productName'] or 'Product' for item in offerings_list],
        'active': [item['activeCount'] for item in offerings_list],
        'cancelled': [item['cancelledCount'] for item in offerings_list],
        'avgSubscriptionPrice': [item['averageSubscriptionPrice'] or 0 for item in offerings_list],
        'avgOnDemandPrice': [item['onDemandUnitPrice'] or 0 for item in offerings_list]
    }
    return {
        'generatedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'filters': filters,
        'farm': farm,
        'offerings': offerings_list,
        'summary': summary,
        'chartData': chartData
    }


def safe_currency(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return '—'
    return f'₱{number:,.2f}'


def safe_number(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return '0'
    return str(int(number)) if number.is_integer() else f'{number:.1f}'


def build_summary_text(summary: Dict[str, Any], filters: Mapping[str, Any]) -> str:
    return f"Window: {filters.get('startDateFrom', '—')} → {filters.get('startDateTo', '—')}"


def page_hero(pdf: PdfPages, report: Dict[str, Any]):
    farm = report.get('farm') or {}
    summary = report.get('summary') or {}
    filters = report.get('filters') or {}
    fig = plt.figure(figsize=(8.5, 11))
    fig.tight_layout()
    fig.text(0.1, 0.95, f"Farmer Subscription Report · Farm #{farm.get('farmId', '—')}", fontsize=18, weight='bold')
    fig.text(0.1, 0.92, farm.get('name') or 'Farm details unavailable', fontsize=14)
    if farm.get('locationLabel'):
        fig.text(0.1, 0.89, farm['locationLabel'], fontsize=11, color='#6b5b53')
    fig.text(0.1, 0.85, build_summary_text(summary, filters), fontsize=11)
    highlights = [
        ('Offering coverage', f"{safe_number(summary.get('offeringCoverage'))} products"),
        ('Clients tracked', safe_number(summary.get('uniqueClients'))),
        ('Active programs', safe_number(summary.get('activePrograms'))),
        ('Cancelled programs', safe_number(summary.get('cancelledPrograms')))
    ]
    y = 0.77
    for label, value in highlights:
        fig.text(0.1, y, label, fontsize=10, color='#6b5b53')
        fig.text(0.1, y - 0.02, value, fontsize=16, weight='bold')
        y -= 0.07
    pdf.savefig(fig)
    plt.close(fig)


def page_charts(pdf: PdfPages, report: Dict[str, Any]):
    offerings = report.get('offerings') or []
    if not offerings:
        fig = plt.figure(figsize=(8.5, 11))
        fig.text(0.3, 0.5, 'No data for this window.', fontsize=14, color='#6b5b53')
        pdf.savefig(fig)
        plt.close(fig)
        return
    fig, axes = plt.subplots(2, 1, figsize=(8.5, 11))
    fig.subplots_adjust(hspace=0.5)
    program_labels = [item.get('productName') or 'Product' for item in offerings]
    active_sizes = [max(item.get('activeCount') or 0, 0) for item in offerings]
    cancelled_sizes = [max(item.get('cancelledCount') or 0, 0) for item in offerings]
    revenue_sizes = [max(item.get('projectedMonthlyRevenue') or 0, 0) for item in offerings]
    active_total = sum(active_sizes)
    cancelled_total = sum(cancelled_sizes)
    if active_total > 0:
        axes[0].pie(active_sizes, labels=program_labels, autopct='%1.1f%%', startangle=140)
        axes[0].set_title(f'Active subscriptions share (Total: {active_total})')
        axes[0].axis('equal')
    else:
        axes[0].text(0.25, 0.5, 'No active subscriptions recorded.', fontsize=12, color='#6b5b53')
        axes[0].axis('off')
    if cancelled_total > 0:
        axes[1].pie(cancelled_sizes, labels=program_labels, autopct='%1.1f%%', startangle=140)
        axes[1].set_title(f'Cancelled subscriptions share (Total: {cancelled_total})')
        axes[1].axis('equal')
    else:
        axes[1].text(0.3, 0.5, 'No cancelled subscriptions recorded.', fontsize=12, color='#6b5b53')
        axes[1].axis('off')
    pdf.savefig(fig)
    plt.close(fig)

    fig2 = plt.figure(figsize=(8.5, 5.5))
    ax = fig2.add_subplot(111)
    active_revenue_sizes = [max(item.get('projectedMonthlyRevenue') or 0, 0) for item in offerings if (item.get('activeCount') or 0) > 0]
    if sum(active_revenue_sizes) > 0:
        labels = [item.get('productName') or 'Product' for item in offerings if (item.get('activeCount') or 0) > 0]
        ax.pie(active_revenue_sizes, labels=labels, autopct='%1.1f%%', startangle=140)
        ax.set_title('Projected monthly revenue contribution (active subscriptions)')
        ax.axis('equal')
    else:
        ax.text(0.25, 0.5, 'No projected revenue from active subscriptions.', fontsize=12, color='#6b5b53')
        ax.axis('off')
    pdf.savefig(fig2)
    plt.close(fig2)


def page_table(pdf: PdfPages, report: Dict[str, Any]):
    offerings = report.get('offerings') or []
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.05, right=0.95, top=0.92)
    ax = fig.add_subplot(111)
    ax.axis('off')
    columns = ['Product', 'Active', 'Cancelled', 'Avg sub price', 'On-demand', 'Δ price', 'Monthly rev']
    table_data = []
    for item in offerings:
        table_data.append([
            item.get('productName') or 'Product',
            safe_number(item.get('activeCount')),
            safe_number(item.get('cancelledCount')),
            safe_currency(item.get('averageSubscriptionPrice')),
            safe_currency(item.get('onDemandUnitPrice')),
            safe_currency(item.get('priceDelta')),
            safe_currency(item.get('projectedMonthlyRevenue'))
        ])
    table = ax.table(cellText=table_data, colLabels=columns, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.2)
    pdf.savefig(fig)
    plt.close(fig)


def page_clients(pdf: PdfPages, report: Dict[str, Any]):
    offerings = report.get('offerings') or []
    fig = plt.figure(figsize=(8.5, 11))
    fig.subplots_adjust(left=0.08, right=0.95, top=0.92)
    ax = fig.add_subplot(111)
    ax.axis('off')
    y = 0.9
    for item in offerings[:5]:
        ax.text(0.0, y, item.get('productName') or 'Product', fontsize=12, weight='bold')
        ax.text(0.0, y - 0.02, f"{safe_number(item.get('activeCount'))} active • Avg price {safe_currency(item.get('averageSubscriptionPrice'))}", fontsize=9)
        y -= 0.05
        if not item.get('clients'):
            ax.text(0.02, y, 'No clients in this window.', fontsize=9, color='#6b5b53')
            y -= 0.04
            continue
        for client in item['clients'][:5]:
            ax.text(0.02, y, f"{client.get('clientName')} · {client.get('statusLabel')}", fontsize=9)
            ax.text(0.02, y - 0.02, f"Qty {safe_number(client.get('quantity'))} · Every {safe_number(client.get('intervalDays'))} days · {safe_currency(client.get('price'))}", fontsize=8, color='#6b5b53')
            y -= 0.05
            if y < 0.1:
                break
        y -= 0.02
        if y < 0.1:
            break
    pdf.savefig(fig)
    plt.close(fig)


def main() -> None:
    args = parse_args()
    filters = {
        'startDateFrom': args.start_date,
        'startDateTo': args.end_date
    }
    if args.product_id:
        filters['productId'] = args.product_id
    conn = connect_db()
    try:
        cursor = conn.cursor(dictionary=True)
        farm = fetch_farm(cursor, args.farm_id)
        if not farm:
            raise SystemExit('Farm not found.')
        offerings = fetch_offerings(cursor, args.farm_id)
        inventory = fetch_inventory(cursor, args.farm_id, args.product_id)
        subscriptions = fetch_subscriptions(cursor, args.farm_id, args.start_date, args.end_date, args.product_id)
        inventory_lookup = build_inventory_lookup(inventory)
        report = build_report(farm, filters, offerings, subscriptions, inventory_lookup)
    finally:
        conn.close()
    FRONTEND_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = Path(args.output) if args.output else FRONTEND_REPORTS_DIR / f"farmer-report-{args.farm_id}-{args.start_date}-{args.end_date}.pdf"
    filename.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(filename) as pdf:
        page_hero(pdf, report)
        page_charts(pdf, report)
        page_table(pdf, report)
        page_clients(pdf, report)
    result = {'path': str(filename.resolve()), 'publicUrl': f"/reports/{filename.name}"}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
