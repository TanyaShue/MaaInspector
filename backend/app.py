from flask import Flask, jsonify
from flask_cors import CORS

# 创建Flask应用实例
app = Flask(__name__)
# 允许所有来源的跨域请求,这在开发中很方便
CORS(app)

@app.route('/api/message')
def get_message():
    """
    一个简单的API端点,返回一个JSON对象.
    """
    response = {
        "message": "Hello from Python Flask! 这是一个来自后端的问候."
    }
    return jsonify(response)

if __name__ == '__main__':
    # 运行在5000端口. 确保这个端口没有被其他应用占用.
    app.run(port=5000)
