from fastapi.responses import JSONResponse

def success(data=None, status=200, message=None):
    body = {"success": True}
    if message is not None:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return JSONResponse(content=body, status_code=status)


def error(code, message, status=400, details=None):
    body = {"success": False, "error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(content=body, status_code=status)


def paginated(data, total, page, per_page):
    body = {
        "success": True,
        "data": data,
        "pagination": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if per_page else 0,
        }
    }
    return JSONResponse(content=body, status_code=200)
