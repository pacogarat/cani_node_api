const { Router } = require('express');
const router = Router();
const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb://localhost:27017/';
const client = new MongoClient(uri);

const colMessages = client.db("local").collection('messages');
const getMessage = async (message_id) => {
    const message = await colMessages.findOne({_id: new ObjectId(message_id)});
    return message;
}

const deleteMessage = async (message_id) => {
    const result = await colMessages.deleteOne({_id: new ObjectId(message_id)});
    return result;
}
const insertMessage = async (message) => {
    const result = await colMessages.insertOne(message);
    return result;
}
const updateMessage = async (message) => {
    console.debug('1');
    const result = await colMessages.updateOne({_id: message._id}, { $set: {text: message.text}});

    console.debug('2');
    return result;
}
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
const validateText = (text) => {
    if (text === null || (typeof text !== 'string' && !(text instanceof String))) throw new ValidationError("No se encontró el campo text");
    return text;
}
router
    .get('/message/:id', async(req, res) => {
        try {
            const message = await getMessage(req.params.id);
            if (message)
                res.status(200).json(message);
            else
                res.status(404).json({errorMessage: "El documento no ha sido encontrado"});
        } catch (e) {
            res.status(500).json({errorMessage: "Error"});
        }
    })
    .delete('/message/:id', async(req, res) => {
        try {
            const result = await deleteMessage(req.params.id);
            if (result.deletedCount > 0)
                res.status(200).json({"Num documentos borrados": result.deletedCount})
            else
                res.status(404).json({errorMessage: "Mensaje no encontrado"});
        } catch (e) {
            res.status(500).json({errorMessage: "Error"});
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
            res.status(200).json();
        } catch (e) {
            const statusCode = (e instanceof ValidationError)? 400 : 500;
            res.status(statusCode).json({error: true, message: "Ocurrió un error"});
        }

    })
    .post('/message', async (req, res) => {
        try {
            const text = validateText(req.body.text);
            const message = {
                text: text
            };
            console.debug("2");
            const result = await insertMessage(message);
            console.debug("3");
            res.status(201).json(result);
        } catch(e) {
            const statusCode = (e instanceof ValidationError)? 400 : 500;
            res.status(statusCode).json({error: true, message: "Ocurrió un error"});
        }
    })
module.exports = router;
