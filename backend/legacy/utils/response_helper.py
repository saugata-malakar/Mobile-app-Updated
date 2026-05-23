from flask import jsonify


def success(data=None, status=200, message=None):
    body = {"success": True}
    if message is not None:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return jsonify(body), status


def error(code, message, status=400, details=None):
    body = {"success": False, "error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return jsonify(body), status


def paginated(data, total, page, per_page):
    return jsonify(
        {
            "success": True,
            "data": data,
            "pagination": {
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page if per_page else 0,
            },
        }
    ), 200
