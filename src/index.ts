import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send(
    "Welcome to the API! Go to /docs to know what routes there are and how to use them",
  );
});

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
