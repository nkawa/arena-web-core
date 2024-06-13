/**
 * @fileoverview Pointcloud process from MQTT
 *
 * @date 2024/6/12 
 * @author Nobuo Kawaguchi
 */

//import { expose } from 'comlink';
import * as Paho from 'paho-mqtt'; // https://www.npmjs.com/package/paho-mqtt

/**
 * MQTT pointcloud-worker client
 */
class PointCloudWorker {
    messageHandlers = {};

    subscriptions = [];

    connectionLostHandlers = [];

    /**
     * @param {string} idTag
     */
    constructor(idTag) {
        // this.restartJitsi = restartJitsi;
        //        console.log("initialize of PCW!")
        this.subscriptions = ["livox_slow"]// [this.config.renderTopic]; // Add main scene renderTopic by default to subs
        this.connectionLostHandlers = [
            (responseObject) => {
                if (responseObject.errorCode !== 0) {
                    console.error(
                        `ARENA MQTT PointCloud connection lost, code: ${responseObject.errorCode},
                        reason: ${responseObject.errorMessage}`
                    );
                }
                console.warn('ARENA MQTT PointCloud automatically reconnecting...');
            },
        ];

        const mqttClient = new Paho.Client("wss://interop2024.uclab.jp:8999/", `webClient-${idTag}`);
        mqttClient.onConnected = async (reconnected, uri) => this.onConnected(reconnected, uri);
        mqttClient.onConnectionLost = async (response) => this.onConnectionLost(response);
        mqttClient.onMessageArrived = this.onMessageArrivedDispatcher.bind(this);
        this.mqttClient = mqttClient;

        //   console.log("PointCloud MQTT Client", mqttClient)
    }

    /**
     * Connect mqtt client; If given, setup a last will message given as argument
     * @param {object} mqttClientOptions paho mqtt options
     * @param {function} onSuccessCallBack callback function on successful connection
     * @param {string} [lwMsg] last will message
     * @param {string} [lwTopic] last will destination topic message
     */
    connect(mqttClientOptions, onSuccessCallBack, lwMsg = undefined, lwTopic = undefined) {
        const opts = {
            onFailure(res) {
                console.error(`ARENA PointCloud connection failed, ${res.errorCode}, ${res.errorMessage}`);
            },
            ...mqttClientOptions,
        };
        if (onSuccessCallBack) {
            opts.onSuccess = onSuccessCallBack;
        } else {
            opts.onSuccess = () => {
                console.info('ARENA PointCloud scene connection success!');
            };
        }

        if (lwMsg && lwTopic && !mqttClientOptions.willMessage) {
            // Last Will and Testament message sent to subscribers if this client loses connection
            const lwt = new Paho.Message(lwMsg);
            lwt.destinationName = lwTopic;
            lwt.qos = 2;
            lwt.retained = false;

            opts.willMessage = lwt;
        }

        this.mqttClient.connect(opts);
    }

    /**
     * Subscribe to a topic and add it to list of subscriptions
     * @param {string} topic
     */
    subscribe(topic) {
        if (!this.subscriptions.includes(topic)) {
            this.subscriptions.push(topic);
            this.mqttClient.subscribe(topic);
        }
    }

    /**
     * Add a handler for when the connection is lost
     * @param {function} handler
     */
    addConnectionLostHandler(handler) {
        if (!this.connectionLostHandlers.includes(handler)) {
            this.connectionLostHandlers.push(handler);
        }
    }

    /**
     * onMessageArrived callback. Dispatches message to registered handlers based on topic category.
     * The category is the string between the first and second slash in the topic.
     * If no handler exists for a given topic category, the message is ignored.
     * @param {Paho.Message} message
     */
    onMessageArrivedDispatcher(message) {
        const topic = message.destinationName;
        //        const topicCategory = topic.split('/')[1];
        const topicCategory = 'p'; // always point!
        // 
        // ここで MQTT メッセージを分解して、表示用に変換
        //        console.log(JSON.parse(message.payloadString))
        const msg = JSON.parse(message.payloadString)

        const binaryString = atob(msg.data); // base64 decode

        //        console.log("Worker MsgLen", msg.data.length, binaryString.length)

        const rows = msg.width
        //const rows = 10000
        const len = binaryString.length;
        const lsize = rows * 12

        const buffer = new ArrayBuffer(lsize)
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < 12; j++) {
                bytes[i * 12 + j] = binaryString.charCodeAt(i * 26 + j);
            }
        }


        let dataView = new DataView(buffer);
        const float32Array = new Float32Array(rows * 3);
        for (let i = 0; i < rows; i++) {
            float32Array[i * 3] = dataView.getFloat32(i * 12, true)
            float32Array[i * 3 + 1] = dataView.getFloat32(i * 12 + 8, true) + 1.5
            float32Array[i * 3 + 2] = dataView.getFloat32(i * 12 + 4, true) - 3
        }

        //        for (let i = 0; i < rows; i++) {
        //            if (float32Array[i] > 10) float32Array[i] = 10;
        //            if (float32Array[i] < -10) float32Array[i] = -10;
        //        }

        //                dataView.getFloat32(0, false)

        //const float32Array = new Float32Array(bytes.buffer);

        //        console.log("Float", float32Array.length)
        //        console.log("x,y,z", float32Array[0], float32Array[1], float32Array[2])
        //        console.log("x,y,z", float32Array[3], float32Array[4], float32Array[5])
        //        console.log("x,y,z", float32Array[6], float32Array[7], float32Array[8])

        //        console.log(rows, binaryString.length, float32Array.length)

        const handler = this.messageHandlers[topicCategory];
        //        console.log("sending", float32Array.length, handler)
        if (handler) {
            handler(float32Array);
        }
    }

    /**
     * Register a message handler for a given topic category beneath realm (second level).
     * @param {string} topicCategory - the topic category to register a handler for
     * @param {function} mainHandler - main thread handler, pass in whatever expected format
     * @param {boolean} isJson - whether the payload is expected to be well-formed json
     */
    registerMessageHandler(topicCategory, mainHandler, isJson) {
        if (isJson) {
            // Parse json in worker
            this.messageHandlers[topicCategory] = mainHandler;

            /*            (message) => {
                            try {
                                const jsonPayload = JSON.parse(message.payloadString);
                                mainHandler({ ...message, payloadObj: jsonPayload });
                            } catch (e) {
                                // Ignore
                            }
                        };
                        */
        } else {
            this.messageHandlers[topicCategory] = mainHandler;
        }
    }

    /**
     * Publish to given dest topic
     * @param {string} topic
     * @param {string|object} payload
     * @param {number} qos
     * @param {boolean} retained
     */
    async publish(topic, payload, qos = 0, retained = false, raw = false) {
        if (!this.mqttClient.isConnected()) return;

        /* eslint-disable no-param-reassign */
        if (typeof payload === 'object' && raw === false) {
            // add timestamp to all published messages
            payload.timestamp = new Date().toISOString();

            payload = JSON.stringify(payload);
        }
        /* eslint-disable no-param-reassign */
        this.mqttClient.publish(topic, payload, qos, retained);
    }

    /**
     * MQTT onConnected callback
     * @param {Boolean} reconnect is a reconnect
     * @param {Object} uri uri used
     */
    async onConnected(reconnect, uri) {

        //        console.log("Connect Pointcloud MQTT: Subscirbe", this.subscriptions)
        this.subscriptions.forEach((topic) => {
            this.mqttClient.subscribe(topic);
        });

        if (reconnect) {
            console.warn(`ARENA MQTT pointcloud reconnected to ${uri}`);
        } //else {
        //            console.info(`ARENA MQTT pointcloud connected to ${uri}`);
        //        }
    }

    /**
     * MQTT onConnectionLost callback
     * @param {Object} responseObject paho response object
     */
    async onConnectionLost(responseObject) {
        this.connectionLostHandlers.forEach((handler) => handler(responseObject));
    }
}

// 今後はメッセージ型でやる
var pcw = null;


onmessage = (e) => {
    switch (e.data[0]) {
        case 'start':
            var pcw = new PointCloudWorker(e.data[1])
            pcw.registerMessageHandler('p',
                (mes) => {
                    postMessage(mes)
                }, false)


            pcw.connect(
                {
                    reconnect: true,
                    userName: "anon",
                    password: "",
                },
                () => {
                    //                    console.log("PointCloud MQTT Connected!")
                }
            )
            break;


    }
}



//expose(PointCloudWorker);
