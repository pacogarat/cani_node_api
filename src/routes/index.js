const { Router } = require('express');
const router = Router();
const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb://localhost:27017/';
const externalUri = 'https://645c042799b618d5f32be872.mockapi.io/ej2/message';
const client = new MongoClient(uri);

const colMessages = client.db("local").collection('messages');
const getMessage = (message_id) => {
    console.log("Fetching doc "+message_id+" from mongoDB");
    const message = colMessages.findOne({_id: new ObjectId(message_id)});
    return message;
}

const deleteMessage = async (message_id) => {
    console.log("Deleting doc "+message_id+" from mongoDB");
    message = await getMessage(message_id);
    const result = colMessages.deleteOne({_id: new ObjectId(message_id)});
    if (message !== null && message.external_id !== null) {
        console.log("Deleting doc with external id \""+message.external_id+"\" from external API");
        await deleteAPIMock(message.external_id);
    }

    return result;
}
const insertMessage = async (message) => {
    console.log("Inserting doc "+message.text+" into API");
    const message_api = await (await insertAPIMock(message.text)).json();
    console.debug(message_api);
    message.external_id = message_api.id;
    const result = colMessages.insertOne(message);
    return result;
}

const insertMessages = async (messages) => {
    console.log("Creating "+messages.length+" docs from API to insert into MongoDB");
    var messagesToInsert = [];
    for (let i=0; i<messages.length; i++) {
        console.log("Creating document "+i);
        const message = {
            external_id:    messages[i].id,
            text:           messages[i].message
        };
        messagesToInsert.push(message);
    }
    console.log("Inserting "+messages.length+" documents into MongoDB");
    colMessages.insertMany(messagesToInsert);

    return messagesToInsert;
}
const updateMessage = async (message) => {
    console.log("Updating document "+message._id);
    const result = colMessages.updateOne({_id: message._id}, { $set: {text: message.text}});
    message = await getMessage(message._id);
    if (message !== null && message.external_id !== null) {
        console.log("Updating doc with external id \""+message.external_id+"\" from external API");
        updateAPIMock(message.external_id, message.text);
    }
    return message;
}
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

const getAllMessagesFromAPIMock = () => {
    console.log("Fetching API data");
    return fetch(externalUri);
}
const deleteAPIMock = (external_id) => {
    console.log("Deleting API doc");
    return fetch(externalUri + "/" + external_id, { method: 'DELETE' });
}
const updateAPIMock = (external_id, text) => {
    console.log("Updating API doc with id: "+external_id);
    return fetch(externalUri + "/" + external_id, {
        method: 'PUT',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ "message": text })
    });
}
const insertAPIMock = async (txt) => {
    console.log("Insert API doc with text: "+txt);
    return fetch(externalUri, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ "message": txt })
    });
}

const clearDB = () => {
    console.log("Clearing BBDD");
    return colMessages.deleteMany({});
}

const validateText = (text) => {
    if (text === null || (typeof text !== 'string' && !(text instanceof String))) throw new ValidationError("No se encontró el campo text");
    return text;
}

router
    /**
     * Borra lo que haya en bbdd inicialmente y carga los mensajes que se trae de la api externa en la bbdd
     */
    .get('/messages/init', async(req, res) => {
        try {
            const response = await getAllMessagesFromAPIMock();
            var messages_api = await response.json();
            await clearDB();
            const messages = await insertMessages(messages_api);
            res.status(200).json(messages);
        } catch (e) {
            res.status(500).json({errorMessage: e.message, stack: e.stack});
        }
    })
    .get('/message/:id', async(req, res) => {
        try {
            const message = await getMessage(req.params.id);
            if (message)
                res.status(200).json(message);
            else
                res.status(404).json({errorMessage: "El documento no ha sido encontrado"});
        } catch (e) {
            const statusCode = (e.name == "BSONError")?404:500;
            res.status(500).json({errorMessage: e.message, stack: e.stack});
        }
    })
    .delete('/message/:id', async(req, res) => {
        try {
            const result = await deleteMessage(req.params.id);

            if (result.deletedCount > 0)
                res.status(200).json({
                    "Num documentos borrados en mongo": result.deletedCount
                })
            else
                res.status(404).json({errorMessage: "Mensaje no encontrado"});
        } catch (e) {
            const statusCode = (e.name === "BSONError")?400:500;
            res.status(statusCode).json({errorMessage: e.message, stack: e.stack});
        }
    })
    .put('/message/:id', async(req, res) => {
        try {
            const message_id = req.params.id;
            const text = validateText(req.body.text);
            const message = {
                _id: new ObjectId(message_id),
                text: text
            };
            const result = await updateMessage(message);
            res.status(200).json(result);
        } catch (e) {
            const statusCode = (e instanceof ValidationError || e.name==="BSONError")? 400 : 500;
            res.status(statusCode).json({errorMessage: e.message, stack: e.stack});
        }

    })
    .post('/message', async (req, res) => {
        try {
            const text = validateText(req.body.text);
            const message = {
                text: text
            };
            console.debug(message);
            const result = await insertMessage(message);
            res.status(201).json(result);
        } catch(e) {
            const statusCode = (e instanceof ValidationError || e.name==="BSONError")? 400 : 500;
            res.status(statusCode).json({errorMessage: e.message, stack: e.stack});
        }
    })

module.exports = router;
