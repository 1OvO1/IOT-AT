// 常量定义
const MQTT_BOOL_TYPE_IS_TRUE = true;
const MQTT_BOOL_TYPE_IS_FALSE = false;
const MQTT_STR_TYPE_IS_NONE = "";

// 定义最新消息映射的类型
interface LatestMessagesMap {
    [topic: string]: string;
}

// 存储订阅话题的回调函数
const mqttSubscribeHandlers: { [topic: string]: (message: string) => void } = {};

// 全局变量
let serialInitialized = MQTT_BOOL_TYPE_IS_FALSE;
let wifiInitialized = MQTT_BOOL_TYPE_IS_FALSE;
let mqttInitialized = MQTT_BOOL_TYPE_IS_FALSE;
let initState = MQTT_BOOL_TYPE_IS_TRUE;
let serialTX: SerialPin = SerialPin.P2;
let serialRX: SerialPin = SerialPin.P1;
let serialBaudRate = 115200;
let wifiSSID = MQTT_STR_TYPE_IS_NONE;
let wifiPassword = MQTT_STR_TYPE_IS_NONE;
let mqttClientID = MQTT_STR_TYPE_IS_NONE;
let mqttUsername = MQTT_STR_TYPE_IS_NONE;
let mqttPassword = MQTT_STR_TYPE_IS_NONE;
let mqttServer = MQTT_STR_TYPE_IS_NONE;
let mqttPort = 1883;

// 存储接收到的消息
let receivedMessage = "";

/**
 * mqtt implementation method.
 */
//% weight=10 color=#008B00 icon="\uf1eb" block="MQTT"
namespace MQTT {

    /**
     * 串口初始化
     * @param receive 接收引脚
     * @param send 发送引脚
     * @param baudRate 波特率
     */
    //% weight=105
    //% receive.fieldEditor="gridpicker" receive.fieldOptions.columns=3
    //% send.fieldEditor="gridpicker" send.fieldOptions.columns=3
    //% blockId=em_mqtt_serial_init
    //% block="串口初始化 | 接收数据 RX: %receive| 发送数据 TX: %send | 波特率: %baudRate"
    //% subcategory="初始化"
    export function em_mqtt_serial_init(receive: SerialPin, send: SerialPin, baudRate: BaudRate): void {
        serialTX = send;
        serialRX = receive;
        serialBaudRate = baudRate;
        serial.redirect(
            serialTX,
            serialRX,
            serialBaudRate
        );
        serial.setTxBufferSize(128);
        serial.setRxBufferSize(128);
        // 简单验证，发送 AT 指令并检查返回结果
        initState = MQTT_BOOL_TYPE_IS_TRUE;
        receivedMessage = "";
        sendATCommand("AT");
        basic.pause(500);
        if (receivedMessage.includes("OK")) {
            serialInitialized = MQTT_BOOL_TYPE_IS_TRUE;
            receivedMessage = ""; // 清空消息
        }
        initState = MQTT_BOOL_TYPE_IS_FALSE;
    }

    /**
     * 检查串口初始化是否成功
     */
    //% blockId=em_mqtt_serial_init_success
    //% block="串口初始化是否成功"
    //% weight=104
    //% subcategory="初始化"
    export function em_mqtt_serial_init_success(): boolean {
        return serialInitialized;
    }

    /**
     * WiFi 初始化
     * @param SSID WiFi 名称
     * @param PASSWORD WiFi 密码
     */
    //% weight=103
    //% blockId=em_mqtt_wifi_init
    //% block="WiFi 初始化 | 名称: %SSID| 密码: %PASSWORD"
    //% subcategory="初始化"
    export function em_mqtt_wifi_init(SSID: string, PASSWORD: string): void {
        if (!serialInitialized) {
            em_mqtt_serial_init(serialRX, serialTX, serialBaudRate);
        }
        wifiSSID = SSID;
        wifiPassword = PASSWORD;
        sendATCommand("AT+CWMODE=1");
        basic.pause(500);
        sendATCommand(`AT+CWJAP="${wifiSSID}","${wifiPassword}"`);
        basic.pause(6000);
        // 检查是否连接成功
        initState = MQTT_BOOL_TYPE_IS_TRUE;
        receivedMessage = "";
        sendATCommand("AT+CWJAP?");
        basic.pause(1000);
        wifiInitialized = receivedMessage.includes("OK")
        initState = MQTT_BOOL_TYPE_IS_FALSE;
    }

    /**
     * 检查 WiFi 初始化是否成功
     */
    //% blockId=em_mqtt_wifi_init_success
    //% block="WiFi 初始化是否成功"
    //% weight=102
    //% subcategory="初始化"
    export function em_mqtt_wifi_init_success(): boolean {
        return wifiInitialized;
    }

    /**
     * MQTT 初始化
     * @param server 服务器地址
     * @param port 服务器端口
     * @param clientId 客户端 ID
     * @param username 客户端用户名
     * @param password 客户端密码
     */
    //% weight=101
    //% blockId=em_mqtt_mqtt_init
    //% block="MQTT 初始化 | 服务器: %server| 端口: %port || 客户端 ID: %clientId | 客户端用户名: %username | 客户端密码: %password"
    //% subcategory="初始化"
    export function em_mqtt_mqtt_init(server: string, port: number, clientId: string, username: string, password: string): void {
        if (!serialInitialized) {
            em_mqtt_serial_init(serialRX, serialTX, serialBaudRate);
        }
        mqttClientID = clientId;
        mqttUsername = username;
        mqttPassword = password;
        mqttServer = server;
        mqttPort = port;
        initState = MQTT_BOOL_TYPE_IS_TRUE;
        receivedMessage = "";
        sendATCommand(`AT+MQTTUSERCFG=0,1,"${mqttClientID}","${mqttUsername}","${mqttPassword}",0,0,""`);
        basic.pause(2000);
        mqttInitialized = receivedMessage.includes("OK")
        receivedMessage = "";
        sendATCommand(`AT+MQTTCONN=0,"${mqttServer}",${mqttPort},1`);
        basic.pause(2000);
        mqttInitialized = mqttInitialized && receivedMessage.includes("OK");
        initState = MQTT_BOOL_TYPE_IS_FALSE;
    }

    /**
     * 检查 MQTT 初始化是否成功
     */
    //% blockId=em_mqtt_mqtt_init_success
    //% block="MQTT 初始化是否成功"
    //% weight=100
    //% subcategory="初始化"
    export function em_mqtt_mqtt_init_success(): boolean {
        return mqttInitialized;
    }

    /**
     * MQTT 订阅话题
     * @param topic 话题名称
     * @param qos QoS 等级
     */
    //% blockId=mqtt_subscribe
    //% block="MQTT 订阅话题 %topic|QoS %qos"
    //% weight=100
    //% subcategory="MQTT 操作"
    export function em_mqtt_subscribe(topic: string, qos: number): void {
        if (!serialInitialized) {
            em_mqtt_serial_init(serialRX, serialTX, serialBaudRate);
        }
        sendATCommand(`AT+MQTTSUB=0,"${topic}",${qos}`);
        basic.pause(1000);
    }

    /**
     * MQTT 订阅话题回调
     * @param topic 话题名称
     * @param handler 回调函数
     */
    //% blockId=em_mqtt_get_topic_message
    //% block="MQTT 订阅话题 %topic 收到消息时"
    //% weight=99
    //% subcategory="MQTT 操作"
    export function em_mqtt_get_topic_message(topic: string, handler: (message: string) => void) {
        if (!serialInitialized) {
            em_mqtt_serial_init(serialRX, serialTX, serialBaudRate);
        }
        mqttSubscribeHandlers[topic] = handler;
    }

    /**
     * MQTT 向话题发送数据
     * @param topic 话题名称
     * @param data 发送的数据
     */
    //% blockId=mqtt_publish_basic
    //% block="MQTT 向话题(TOPIC) %topic 发送数据 %data"
    //% weight=98
    //% subcategory="MQTT 操作"
    export function em_mqtt_publish_basic(topic: string, data: any): void {
        if (!serialInitialized) {
            em_mqtt_serial_init(serialRX, serialTX, serialBaudRate);
        }
        sendATCommand(`AT+MQTTPUB=0,"${topic}","${data}",1,0`);
        basic.pause(200);
    }

    // 发送 AT 指令
    function sendATCommand(command: string): void {
        serial.writeString(command + "\r\n");
    }

    /**
 * 将字符串转换为字节数组（简单 ASCII 范围）
 * @param str 输入字符串
 * @returns 字节数组
 */
    function stringToBytes(str: string): number[] {
        const bytes: number[] = [];

        for (let i = 0; i < str.length; i++) {
            // 获取字符的 Unicode 编码值
            const charCode = str.charCodeAt(i);

            // 只处理 ASCII 范围内的字符（0-127）
            // 对于 UTF-8 多字节字符，需要更复杂的处理
            bytes.push(charCode & 0xFF);
        }

        return bytes;
    }

    // 处理接收到的串口数据
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        // receivedMessage += serial.readString();
        let bytes: number[] = [];
        let str = serial.readString();
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }

        const decodedMessage = advancedUtf8Decode(bytes);
        receivedMessage += decodedMessage;

        // 存储每个topic的最新消息
        const latestMessages: LatestMessagesMap = {};

        while (receivedMessage.includes("+MQTTSUBRECV:")) {
            const firstIndex = receivedMessage.indexOf("+MQTTSUBRECV:");
            const nextNewLine = receivedMessage.indexOf("\r\n", firstIndex);
            const endIndex = nextNewLine !== -1 ? nextNewLine : receivedMessage.length;
            let subMessage = receivedMessage.slice(firstIndex, endIndex);

            if (subMessage.includes("+MQTTSUBRECV")) {
                const firstColon = subMessage.indexOf(":");
                const firstComma = subMessage.indexOf(",");
                const topic = subMessage.slice(firstColon + 1, firstComma);
                const message = subMessage.slice(firstComma + 1);
                // 只保存每个topic的最新消息
                latestMessages[topic] = message;
            }

            receivedMessage = receivedMessage.slice(nextNewLine + 1);
        }

        // 处理每个topic的最新消息
        const topics = Object.keys(latestMessages);
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (mqttSubscribeHandlers[topic]) {
                mqttSubscribeHandlers[topic](latestMessages[topic]);
            }
        }
        // 清空缓冲区，避免无限增长
        if (!initState) {
            receivedMessage = "";
        }
    });

    /**
     * UTF-8解码，支持更多字符
     */
    function advancedUtf8Decode(bytes: number[]): string {
        let result = "";
        let i = 0;
        const length = bytes.length;

        while (i < length) {
            const byte = bytes[i];

            // 单字节ASCII
            if ((byte & 0x80) === 0) {
                result += String.fromCharCode(byte);
                i++;
            }
            // 双字节UTF-8
            else if ((byte & 0xE0) === 0xC0 && i + 1 < length) {
                const codePoint = ((byte & 0x1F) << 6) | (bytes[i + 1] & 0x3F);
                result += String.fromCharCode(codePoint);
                i += 2;
            }
            // 三字节UTF-8（中文）
            else if ((byte & 0xF0) === 0xE0 && i + 2 < length) {
                const codePoint = ((byte & 0x0F) << 12) |
                    ((bytes[i + 1] & 0x3F) << 6) |
                    (bytes[i + 2] & 0x3F);
                result += String.fromCharCode(codePoint);
                i += 3;
            }
            // 四字节UTF-8（表情符号等）
            else if ((byte & 0xF8) === 0xF0 && i + 3 < length) {
                const codePoint = ((byte & 0x07) << 18) |
                    ((bytes[i + 1] & 0x3F) << 12) |
                    ((bytes[i + 2] & 0x3F) << 6) |
                    (bytes[i + 3] & 0x3F);
                result += String.fromCharCode(codePoint);
                i += 4;
            }
            // 无效字节
            else {
                result += "?";
                i++;
            }
        }

        return result;
    }
}
