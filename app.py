from datetime import datetime
import os
import re

from bson import ObjectId
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from pymongo.errors import ServerSelectionTimeoutError
from pymongo import ASCENDING, DESCENDING, MongoClient

app = Flask(__name__)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
allowed_origins = [
    origin.strip()
    for origin in frontend_origin.split(",")
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": allowed_origins or "*"}})

mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
mongo_db_name = os.getenv("MONGO_DB", "attendance_system")

client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
db = client[mongo_db_name]
employees_collection = db["employees"]
attendance_collection = db["attendance"]


@app.errorhandler(ServerSelectionTimeoutError)
def mongo_connection_error(error):
    if request.path.startswith("/api/"):
        return jsonify({
            "error": "MongoDB is not running or MONGO_URI is not configured"
        }), 500

    return (
        "<h2>MongoDB is not running</h2>"
        "<p>Start MongoDB on <code>127.0.0.1:27017</code>, "
        "or set <code>MONGO_URI</code> to your MongoDB connection string.</p>",
        500
    )


def serialize_employee(employee):
    employee["id"] = str(employee["_id"])
    return employee


def serialize_attendance(record):
    record["id"] = str(record["_id"])
    if isinstance(record.get("attendance_date"), datetime):
        record["attendance_date"] = record["attendance_date"].strftime("%Y-%m-%d")
    if isinstance(record.get("check_in"), datetime):
        record["check_in"] = record["check_in"].strftime("%H:%M:%S")
    if isinstance(record.get("check_out"), datetime):
        record["check_out"] = record["check_out"].strftime("%H:%M:%S")
    return record


def employee_payload(source):
    return {
        "employee_code": source.get("employee_code", "").strip(),
        "name": source.get("name", "").strip(),
        "department": source.get("department", "").strip()
    }


def api_payload():
    return request.get_json(silent=True) or request.form


def today_bounds():
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start, end


def attendance_with_employee(record):
    employee = employees_collection.find_one({"_id": record["employee_id"]})
    if not employee:
        return None

    record.update({
        "employee_code": employee["employee_code"],
        "name": employee["name"],
        "department": employee["department"]
    })
    return serialize_attendance(record)


@app.route("/api/health")
def api_health():
    client.admin.command("ping")
    return jsonify({
        "status": "ok",
        "database": mongo_db_name
    })


@app.route("/api/dashboard")
def api_dashboard():
    start, end = today_bounds()

    total = employees_collection.count_documents({})
    present = len(attendance_collection.distinct(
        "employee_id",
        {
            "attendance_date": {"$gte": start, "$lte": end},
            "status": {"$in": ["Present", "Late"]}
        }
    ))
    late = attendance_collection.count_documents({
        "attendance_date": {"$gte": start, "$lte": end},
        "status": "Late"
    })
    recent = [
        serialize_employee(employee)
        for employee in employees_collection
        .find()
        .sort("created_at", DESCENDING)
        .limit(5)
    ]

    return jsonify({
        "total": total,
        "present": present,
        "absent": total - present,
        "late": late,
        "recent": recent
    })


@app.route("/api/employees", methods=["GET", "POST"])
def api_employees():
    if request.method == "POST":
        data = employee_payload(api_payload())

        if not all(data.values()):
            return jsonify({"error": "employee_code, name, and department are required"}), 400

        data["created_at"] = datetime.now()
        result = employees_collection.insert_one(data)
        employee = employees_collection.find_one({"_id": result.inserted_id})

        return jsonify(serialize_employee(employee)), 201

    search = request.args.get("search", "")
    query = {}

    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query = {
            "$or": [
                {"employee_code": pattern},
                {"name": pattern},
                {"department": pattern}
            ]
        }

    employees_data = [
        serialize_employee(employee)
        for employee in employees_collection.find(query).sort("_id", DESCENDING)
    ]

    return jsonify(employees_data)


@app.route("/api/employees/<id>", methods=["GET", "PUT", "DELETE"])
def api_employee_detail(id):
    employee_id = ObjectId(id)

    if request.method == "DELETE":
        employees_collection.delete_one({"_id": employee_id})
        attendance_collection.delete_many({"employee_id": employee_id})
        return "", 204

    if request.method == "PUT":
        data = employee_payload(api_payload())

        if not all(data.values()):
            return jsonify({"error": "employee_code, name, and department are required"}), 400

        employees_collection.update_one({"_id": employee_id}, {"$set": data})

    employee = employees_collection.find_one({"_id": employee_id})
    if not employee:
        return jsonify({"error": "Employee not found"}), 404

    return jsonify(serialize_employee(employee))


@app.route("/api/attendance", methods=["GET", "POST"])
def api_attendance():
    if request.method == "POST":
        data = api_payload()
        employee_id = ObjectId(data.get("employee_id"))
        status = data.get("status", "Present")
        start, end = today_bounds()

        existing = attendance_collection.find_one({
            "employee_id": employee_id,
            "attendance_date": {"$gte": start, "$lte": end}
        })

        if existing:
            return jsonify({"error": "Attendance is already marked for today"}), 409

        now = datetime.now()
        result = attendance_collection.insert_one({
            "employee_id": employee_id,
            "attendance_date": now,
            "check_in": now,
            "check_out": None,
            "status": status
        })
        record = attendance_collection.find_one({"_id": result.inserted_id})

        return jsonify(attendance_with_employee(record)), 201

    attendance_data = []

    for record in attendance_collection.find().sort([
        ("attendance_date", DESCENDING),
        ("_id", DESCENDING)
    ]):
        item = attendance_with_employee(record)
        if item:
            attendance_data.append(item)

    return jsonify(attendance_data)


@app.route("/api/attendance/<attendance_id>/checkout", methods=["POST"])
def api_checkout(attendance_id):
    attendance_collection.update_one(
        {"_id": ObjectId(attendance_id)},
        {"$set": {"check_out": datetime.now()}}
    )
    record = attendance_collection.find_one({"_id": ObjectId(attendance_id)})

    if not record:
        return jsonify({"error": "Attendance record not found"}), 404

    return jsonify(attendance_with_employee(record))


# =========================
# DASHBOARD
# =========================

@app.route("/")
def dashboard():
    start, end = today_bounds()

    total = employees_collection.count_documents({})

    present = len(attendance_collection.distinct(
        "employee_id",
        {
            "attendance_date": {"$gte": start, "$lte": end},
            "status": {"$in": ["Present", "Late"]}
        }
    ))

    late = attendance_collection.count_documents({
        "attendance_date": {"$gte": start, "$lte": end},
        "status": "Late"
    })

    absent = total - present

    recent = [
        serialize_employee(employee)
        for employee in employees_collection
        .find()
        .sort("created_at", DESCENDING)
        .limit(5)
    ]

    return render_template(
        "dashboard.html",
        total=total,
        present=present,
        absent=absent,
        late=late,
        recent=recent
    )


# =========================
# EMPLOYEES
# =========================

@app.route("/employees")
def employees():
    search = request.args.get("search", "")
    query = {}

    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query = {
            "$or": [
                {"employee_code": pattern},
                {"name": pattern},
                {"department": pattern}
            ]
        }

    employees_data = [
        serialize_employee(employee)
        for employee in employees_collection.find(query).sort("_id", DESCENDING)
    ]

    return render_template(
        "employees.html",
        employees=employees_data,
        search=search
    )


# =========================
# ADD EMPLOYEE
# =========================

@app.route("/add", methods=["GET", "POST"])
def add_employee():
    if request.method == "POST":
        employees_collection.insert_one({
            "employee_code": request.form["employee_code"],
            "name": request.form["name"],
            "department": request.form["department"],
            "created_at": datetime.now()
        })

        return redirect(url_for("employees"))

    return render_template("add_employee.html")


# =========================
# EDIT EMPLOYEE
# =========================

@app.route("/edit/<id>", methods=["GET", "POST"])
def edit_employee(id):
    employee_id = ObjectId(id)

    if request.method == "POST":
        employees_collection.update_one(
            {"_id": employee_id},
            {
                "$set": {
                    "employee_code": request.form["employee_code"],
                    "name": request.form["name"],
                    "department": request.form["department"]
                }
            }
        )

        return redirect(url_for("employees"))

    employee = employees_collection.find_one({"_id": employee_id})

    return render_template("edit_employee.html", employee=serialize_employee(employee))


# =========================
# DELETE EMPLOYEE
# =========================

@app.route("/delete/<id>")
def delete_employee(id):
    employee_id = ObjectId(id)

    employees_collection.delete_one({"_id": employee_id})
    attendance_collection.delete_many({"employee_id": employee_id})

    return redirect(url_for("employees"))


# =========================
# ATTENDANCE
# =========================

@app.route("/attendance")
def attendance():
    attendance_data = []

    for record in attendance_collection.find().sort([
        ("attendance_date", DESCENDING),
        ("_id", DESCENDING)
    ]):
        employee = employees_collection.find_one({"_id": record["employee_id"]})
        if not employee:
            continue

        record.update({
            "employee_code": employee["employee_code"],
            "name": employee["name"],
            "department": employee["department"]
        })
        attendance_data.append(serialize_attendance(record))

    return render_template(
        "attendance.html",
        attendance=attendance_data
    )


@app.route("/mark_attendance", methods=["GET", "POST"])
def mark_attendance():
    if request.method == "POST":
        employee_id = ObjectId(request.form["employee_id"])
        status = request.form["status"]
        start, end = today_bounds()

        existing = attendance_collection.find_one({
            "employee_id": employee_id,
            "attendance_date": {"$gte": start, "$lte": end}
        })

        if existing:
            return redirect(url_for("attendance"))

        now = datetime.now()
        attendance_collection.insert_one({
            "employee_id": employee_id,
            "attendance_date": now,
            "check_in": now,
            "check_out": None,
            "status": status
        })

        return redirect(url_for("attendance"))

    employees = [
        serialize_employee(employee)
        for employee in employees_collection.find().sort("name", ASCENDING)
    ]

    return render_template(
        "mark_attendance.html",
        employees=employees
    )


@app.route("/checkout/<attendance_id>")
def checkout(attendance_id):
    attendance_collection.update_one(
        {"_id": ObjectId(attendance_id)},
        {"$set": {"check_out": datetime.now()}}
    )

    return redirect(url_for("attendance"))


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
