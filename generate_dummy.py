from datetime import date, timedelta
import random
from collections import Counter


def generate_sql():
    random.seed(42)

    start_date = date(2025, 5, 24)
    end_date = date(2025, 11, 24)

    def sql_value(val):
        if val is None:
            return "NULL"
        if isinstance(val, str):
            return "'" + val.replace("'", "''") + "'"
        if isinstance(val, date):
            return "'" + val.isoformat() + "'"
        if isinstance(val, float):
            return f"{val:.2f}"
        return str(val)

    lines = []
    lines.append("-- Dummy data for kungfoodpanda_db")
    lines.append("USE kungfoodpanda_db;")
    lines.append("")

    def insert_block(table, columns, rows):
        if not rows:
            return
        lines.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES")
        row_strs = []
        for row in rows:
            vals = [sql_value(row[col]) for col in columns]
            row_strs.append("  (" + ", ".join(vals) + ")")
        lines.append(",\n".join(row_strs) + ";")
        lines.append("")

    # ---------- Location ----------
    locations = []
    for loc_id in range(1, 11):
        locations.append(
            {
                "location_id": loc_id,
                "continent": "Asia",
                "country": "Philippines",
                "state": "Metro Manila",
                "city": f"City {loc_id}",
                "street": f"{loc_id} Taft Avenue",
            }
        )

    insert_block(
        "Location",
        ["location_id", "continent", "country", "state", "city", "street"],
        locations,
    )

    # ---------- RawProduct ----------
    product_names = [
        ("Huitla", "Fungus", "crops"),
        ("Moss", "Seaweed", "algal beds"),
        ("F.Limes", "Fruit", "trees"),
        ("Chapul", "Insect", "colonies"),
        ("Doenjang", "Fermented", "vats"),
        ("Bottarga", "Animal Product", "fish"),
        ("Oca", "Root Vegetable", "fields"),
        ("Onit", "Floral", "vines"),
    ]
    grades = ["SSR", "SR", "R", "UC", "C"]

    raw_products = []
    for pid, (name, ptype, _) in enumerate(product_names, start=1):
        raw_products.append(
            {
                "product_id": pid,
                "product_name": name,
                "product_type": ptype,
                "grade": grades[(pid - 1) % len(grades)],
                "start_season": date(2025, 1, 1),
                "end_season": date(2025, 12, 31),
            }
        )

    insert_block(
        "RawProduct",
        [
            "product_id",
            "product_name",
            "product_type",
            "grade",
            "start_season",
            "end_season",
        ],
        raw_products,
    )

    # ---------- Client ----------
    clients = [
        {
            "company_name": "Foodies Inc.",
            "first_name": "Alice",
            "last_name": "Smith",
            "honorific": "Ms.",
            "email": "alice.smith@foodies.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Gourmet Delights",
            "first_name": "Bob",
            "last_name": "Johnson",
            "honorific": "Mr.",
            "email": "bob.johnson@gourmet.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Delicious Eats",
            "first_name": "Charlie",
            "last_name": "Williams",
            "honorific": "Mrs.",
            "email": "charlie.williams@delicious.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Tasty Treats",
            "first_name": "Diana",
            "last_name": "Brown",
            "honorific": "Ms.",
            "email": "diana.brown@tasty.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Yummy Bites",
            "first_name": "Ethan",
            "last_name": "Jones",
            "honorific": "Mr.",
            "email": "ethan.jones@yummy.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Savory Snacks",
            "first_name": "Fiona",
            "last_name": "Garcia",
            "honorific": "Mrs.",
            "email": "fiona.garcia@savory.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Culinary Creations",
            "first_name": "George",
            "last_name": "Miller",
            "honorific": "Mr.",
            "email": "george.miller@culinary.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Epicurean Delights",
            "first_name": "Hannah",
            "last_name": "Davis",
            "honorific": "Ms.",
            "email": "hannah.davis@epicurean.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Flavorful Foods",
            "first_name": "Ian",
            "last_name": "Rodriguez",
            "honorific": "Mr.",
            "email": "ian.rodriguez@flavorful.com",
            "loyalty_points": random.randint(0, 500),
        },
        {
            "company_name": "Delectable Dishes",
            "first_name": "Julia",
            "last_name": "Martinez",
            "honorific": "Mrs.",
            "email": "julia.martinez@delectable.com",
            "loyalty_points": random.randint(0, 500),
        },
    ]

    for cid in range(1, 11):
        clients[cid - 1]["client_id"] = cid
        clients[cid - 1]["location_id"] = cid

    insert_block(
        "Client",
        [
            "client_id",
            "company_name",
            "first_name",
            "last_name",
            "honorific",
            "email",
            "location_id",
            "loyalty_points",
        ],
        clients,
    )

    # ---------- Farm ----------
    farms = [
        {"name": "Green Valley Farms"},
        {"name": "Sunnybrook Agriculture"},
        {"name": "Riverbend Produce"},
        {"name": "Golden Harvest Farms"},
        {"name": "Meadowview Organics"},
        {"name": "Hilltop Gardens"},
        {"name": "Cedarwood Farms"},
        {"name": "Willow Creek Produce"},
        {"name": "Maple Leaf Agriculture"},
        {"name": "Pine Hill Farms"},
    ]
    for fid in range(1, 11):
        farms[fid - 1]["farm_id"] = fid
        farms[fid - 1]["location_id"] = fid

    insert_block(
        "Farm",
        ["farm_id", "name", "location_id"],
        farms,
    )

    # ---------- FarmProduct ----------
    farm_products = []
    farm_to_products = {fid: [] for fid in range(1, 11)}
    num_raw = len(raw_products)

    for fid in range(1, 11):
        available_pids = list(range(1, num_raw + 1))
        random.shuffle(available_pids)
        chosen = available_pids[:3]  # 3 products per farm
        for pid in chosen:
            farm_products.append(
                {
                    "product_id": pid,
                    "farm_id": fid,
                    "population": random.randint(50, 100),
                    "population_unit": product_names[pid - 1][2],
                }
            )
            farm_to_products[fid].append(pid)

    insert_block(
        "FarmProduct",
        ["product_id", "farm_id", "population", "population_unit"],
        farm_products,
    )

    # ---------- Inventory ----------
    inventory_rows = []
    fp_to_batches = {}  # (farm_id, product_id) -> [batch_ids]
    next_batch_id = 1

    def random_exp_date():
        base = date(2025, 6, 1)
        delta_days = random.randint(60, 300)  # roughly Aug 2025–Mar 2026
        return base + timedelta(days=delta_days)

    # at least 1 batch per farm-product
    for fp in farm_products:
        fid = fp["farm_id"]
        pid = fp["product_id"]
        inv = {
            "batch_id": next_batch_id,
            "product_id": pid,
            "farm_id": fid,
            "price": round(random.uniform(50, 200), 2),
            "weight": round(random.uniform(5, 50), 2),
            "notes": f"Initial batch of product {pid} from farm {fid}",
            "exp_date": random_exp_date(),
            "quantity": random.randint(100, 500),
        }
        inventory_rows.append(inv)
        fp_to_batches.setdefault((fid, pid), []).append(next_batch_id)
        next_batch_id += 1

    # pad to 25 inventory rows per farm
    count_per_farm = Counter(inv["farm_id"] for inv in inventory_rows)

    for fid in range(1, 11):
        while count_per_farm[fid] < 25:
            pid = random.choice(farm_to_products[fid])
            inv = {
                "batch_id": next_batch_id,
                "product_id": pid,
                "farm_id": fid,
                "price": round(random.uniform(50, 200), 2),
                "weight": round(random.uniform(5, 50), 2),
                "notes": None,
                "exp_date": random_exp_date(),
                "quantity": random.randint(50, 300),
            }
            inventory_rows.append(inv)
            fp_to_batches.setdefault((fid, pid), []).append(next_batch_id)
            next_batch_id += 1
            count_per_farm[fid] += 1

    insert_block(
        "Inventory",
        [
            "batch_id",
            "product_id",
            "farm_id",
            "price",
            "weight",
            "notes",
            "exp_date",
            "quantity",
        ],
        inventory_rows,
    )

    # ---------- Subscription ----------
    subscriptions = []
    next_program_id = 1

    for client in clients:
        cid = client["client_id"]
        fid = ((cid - 1) % len(farms)) + 1  # client i → farm i
        for fid in random.choices(range(1, 11), k=10): # 10 subscriptions per client
            pid = random.choice(farm_to_products[fid])
            sub = {
                "program_id": next_program_id,
                "product_id": pid,
                "farm_id": fid,
                "client_id": cid,
                "order_interval_days": 7,
                "start_date": start_date,
                "quantity": random.randint(1, 5),
                "location_id": client["location_id"],
                "price": round(random.uniform(80, 250), 2),
                "status": random.choice(["ACTIVE", "AWAITING_QUOTE", "CANCELLED"]),
            }
            subscriptions.append(sub)
            next_program_id += 1

    insert_block(
        "Subscription",
        [
            "program_id",
            "product_id",
            "farm_id",
            "client_id",
            "order_interval_days",
            "start_date",
            "quantity",
            "location_id",
            "price",
            "status",
        ],
        subscriptions,
    )

    # ---------- Orders ----------
    orders = []
    next_order_id = 1

    for sub in subscriptions:
        cid = sub["client_id"]
        fid = sub["farm_id"]
        pid = sub["product_id"]
        interval = sub["order_interval_days"]
        qty = sub["quantity"]
        loc_id = sub["location_id"]

        cur_date = sub["start_date"]
        while cur_date <= end_date:
            batches = fp_to_batches[(fid, pid)]
            batch_id = random.choice(batches)

            due_by = cur_date + timedelta(days=random.randint(3, 7))

            if random.random() < 0.9:
                ship_delay = random.randint(1, 5)
                shipped_date = cur_date + timedelta(days=ship_delay)
            else:
                shipped_date = None

            orders.append(
                {
                    "order_id": next_order_id,
                    "client_id": cid,
                    "batch_id": batch_id,
                    "location_id": loc_id,
                    "order_date": cur_date,
                    "quantity": qty,
                    "shipped_date": shipped_date,
                    "due_by": due_by,
                    "loyalty_points_used": random.choice([0, 0, 0, 10, 20, 30]),
                }
            )
            next_order_id += 1
            cur_date = cur_date + timedelta(days=interval)

    # sanity: ≥25 orders per client
    per_client = Counter(o["client_id"] for o in orders)
    assert all(per_client[c["client_id"]] >= 25 for c in clients)

    insert_block(
        "Orders",
        [
            "order_id",
            "client_id",
            "batch_id",
            "location_id",
            "order_date",
            "quantity",
            "shipped_date",
            "due_by",
            "loyalty_points_used",
        ],
        orders,
    )

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_sql())
