# MeetMind API

MeetMind 鍚庣鏈嶅姟锛屽熀浜?FastAPI 鏋勫缓銆?
## 杩愯

```bash
# 鍒涘缓铏氭嫙鐜
python3 -m venv .venv
source .venv/bin/activate

# 瀹夎渚濊禆
pip install -e ".[dev]"

# 鍚姩鏈嶅姟
uvicorn app.main:app --reload --port 3452
```

## API 鏂囨。

鍚姩鏈嶅姟鍚庤闂細

- Swagger UI: http://localhost:3452/docs
- ReDoc: http://localhost:3452/redoc
