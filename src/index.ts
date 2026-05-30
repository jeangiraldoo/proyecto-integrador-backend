import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import authRoutes from "./Routes/auth";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const allowedOrigins = ["https://proyecto-integrador-frontend-psi.vercel.app"];

app.use(
	cors({
		origin(origin, callback) {
			// Allow requests without an Origin header
			// (e.g. Postman, curl, server-to-server requests)
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

const options = {
	failOnErrors: true, // Whether or not to throw when parsing errors. Defaults to false.
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

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
