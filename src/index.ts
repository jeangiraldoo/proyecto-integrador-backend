import http from "http";
import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import authRoutes from "./Routes/auth";
import roomRoutes from "./Routes/rooms";
import cors from "cors";
import dotenv from "dotenv";
import { initSocket } from "./socket";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? "3000";

const allowedOrigins = ["https://proyecto-integrador-frontend-psi.vercel.app"];

app.use(
	cors({
		origin(origin, callback) {
			if (!origin) {
				return callback(null, true);
			}

			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}

			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	}),
);

app.use(express.json());
app.get("/", (req, res) => {
	res.send("Welcome to the API! Go to /docs to know what routes there are and how to use them");
});
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);

const options = {
	failOnErrors: true,
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Backend API",
			version: "0.1.0",
		},
	},
	apis: ["./src/Routes/*.ts"],
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(options)));

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
