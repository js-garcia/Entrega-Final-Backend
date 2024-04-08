// Configuracion de .env
import dotenv from "dotenv";
dotenv.config();

import cors from 'cors';
import express from "express";
import paymentsRoutes from './routes/payments.routes.js';
import config from "./config.js";
import mongoose from "mongoose";
import handlebars from "express-handlebars";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import session from "express-session";
import FileStore from "session-file-store";
import MongoStore from "connect-mongo";
import passport from "passport";
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';

import { __dirname } from "./utils.js";
import { getMockingProducts } from "./mockingProducts.js";
import viewsRouter from "./routes/views.routes.js";
import productsRouter from "./routes/products.routes.js";
import usersRouter from "./routes/users.routes.js";
import cartsRouter from "./routes/carts.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import cookiesRouter from "./routes/cookies.routes.js";
import sessionsRouter from "./routes/sessions.routes.js";
import messageModel from "./models/messages.model.js";
import productModel from "./models/product.model.js";
import MongoSingleton from "./dao/mongo.singleton.js";
import CustomError from './dao/error.custom.class.js';
import errorsDictionary from './dao/error.dictionary.js';
import addLogger from "./logger.js";

const PORT = process.env.PORT || 5500;
//MongoDB URL desde .env
const mongoose_URL = process.env.MONGOOSE_URI;

// configuración Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.1',
    info: {
      title: 'Documentación del proyecto',
      description: '¡Bienvenido a la documentación del proyecto!.',
    },
  },
  apis: ['./src/routes/*.routes.js'],
};

const specs = swaggerJsdoc(swaggerOptions);

// Configuración de express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,PATCH,DELETE' }));
app.use(`/${config.API_PAYMENTS_PREFIX}`, paymentsRoutes);
app.use('/static', express.static(`${config.__DIRNAME}/public`));
app.all('*', (req, res) => {
    res.status(404).send({ status: -1, payload: 'No se encuentra la ruta solicitada' });
});

app.listen(config.APP_PORT, () => {
    console.log(`App activa en puerto ${config.APP_PORT}`);
});


// Configuración de sesiones
// Si queremos almacenar datos de sesión en archivo, utilizamos el módulo
  // session-file-store, creamos una instancia y configuramos debajo el store. Si en cambio preferimos guardar a MongoDB, utilizamos connect-mongo, pero el proceso es similar al configurar el store.
const fileStorage = FileStore(session);
app.use(
  session({
    // Recordar!!!. habilitar UNO de los dos, NO ambos a la vez
      // store: new fileStorage({ path: './sessions', ttl: 60, retries: 0 })
    store: MongoStore.create({
      mongoUrl: mongoose_URL,
      mongoOptions: {},
      ttl: 200,
      clearInterval: 5000,
    }), // MONGODB
    secret: "secretKeyAbc123",
    resave: false,
    saveUninitialized: false,
  })
);
// Configuración de passport
app.use(passport.initialize());
app.use(passport.session());

// Configuración de handlebars
app.engine('handlebars', handlebars.engine())
app.set('view engine', 'handlebars')
app.set('views', __dirname + '/views')
app.use(express.static(__dirname + '/public'))

//loggerTest endpoint para probar middleware de logger
app.use(addLogger);
app.get("/loggerTest", (req, res) => {
  req.logger.debug("This is a debug  log");
  req.logger.http("This is an http  log");
  req.logger.info("This is an info  log");
  req.logger.warning("This is a warning  log");
  req.logger.error("This is an error  log");
  req.logger.fatal("This is a fatal  log");
  res.send("Logged all levels");
});

// Configuración de rutas
app.get("/", (req, res) => res.render("index", { name: "Tutor" }));
app.use("/", viewsRouter);
app.use("/api/products", productsRouter);
app.use("/api/carts", cartsRouter);
app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/cookies", cookiesRouter);
app.use("/api/sessions", sessionsRouter);
//app.use("/api/auth/recover", recoverPasswordRouter);
app.get("/mockingproducts", (req, res) => getMockingProducts(req, res));
// Endpoint Swagger documentation
app.use('/api/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(specs));

// Configuración de Mongoose
mongoose.set("strictQuery", false);

// Inicialización de servidor HTTP
try {
  // Conexión a MongoDB
  MongoSingleton.getInstance(mongoose_URL);
  await mongoose.connect(mongoose_URL);

  const httpServer = app.listen(PORT, () =>
    console.log(`Listening port ${PORT} ✅ MongoDB connected 🔌`)
  );

  // Configuración de socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["PUT", "GET", "POST", "DELETE", "OPTIONS"],
      credentials: false,
    },
  });

  // Init
  let users = {};

  io.on("connection", async (socket) => {
    //el RealTimeProducts, hay que hacer refrescar la pagina no es automatico nose porque 
    socket.on('productList', data => {
      io.emit('updatedProducts', data)
    })

    console.log(`Successful connection  socket ID: ${socket.id}`);

    socket.on("login", async (name) => {
      console.log(`The user ${name} with socket ID ${socket.id} has logged in`);
      socket.broadcast.emit("newUser", name);
      users[socket.id] = name;
      let messages = await getChats();
      socket.emit("getMessages", messages);
    });

    socket.on("message", async (messages) => {
      console.log(
        `The user ${messages.user} sent the following message: ${messages.message}`
      );
      messages.timestamp = new Date();
      io.emit("newMessage", messages);
      await saveChats(messages);
    });

    socket.on("disconnect", () => {
      let disconnectedUser = users[socket.id];

      if (disconnectedUser) {
        io.emit("userDisconnect", disconnectedUser);
        delete users[socket.id];
      }
    });
  });
} catch (err) {
  console.error(`Backend: error al inicializar 🚨🚨🚨(${err.message})`);
}

// Manejo de eventos para finalización y excepciones
process.on("exit", (code) => {
  switch (code) {
    case -4:
      console.log(
        "Proceso finalizado por argumentación inválida en una función"
      );
      break;

    default:
      console.log(`El proceso de servidor finalizó (err: ${code})`);
  }
});

process.on("uncaughtException", (exception) => {
  console.error(exception.name);
  console.error(exception.message);
});

async function getChats() {
  try {
    let result = await messageModel.find();
    return result;
  } catch (error) {
    console.error("Error loading the chats :", error);
  }
}

async function saveChats(messages) {
  try {
    console.log("Saving messages: ", messages);

    if (!messages.user) {
      console.error("User field is missing or undefined🔎");
      return;
    }
    let result = await messageModel.create(messages);
    return result;
  } catch (error) {
    console.error("Error saving the chats :", error);
  }
}

// Manejo de errores
app.use((err, req, res, next) => {
  const code = err.code || 500;
  res.status(code).json({ error: err.message });
});

// Ruta para manejar solicitudes no encontradas
app.all('*', (req, res, next) => {
  res.status(404).json({ error: errorsDictionary.PAGE_NOT_FOUND.message });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handler
app.use((err, req, res, next) => {
  const code = err.code || 500;
  let errorMessage = err.message || 'Internal Server Error';

  if (errorsDictionary.hasOwnProperty(err.code)) {
    errorMessage = errorsDictionary[err.code].message;
  }

  // If the error is an instance of CustomError, use the custom error message
  if (err instanceof CustomError) {
    errorMessage = err.message;
  }

  res.status(code).json({ error: errorMessage });
});
//Para el test
export default app;