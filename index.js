const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORST || 5000;
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lzmavpv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware ; verifying user by token
const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
      if (error) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.log(error);
  }
};

async function run() {
  try {
    await client.connect();
    // auth api starts from here-----------------------
    // createing access token--------------------------
    app.post("/api/v1/auth/access-token", (req, res) => {
      try {
        const user = req.body;
        console.log(user);
        const token = jwt.sign(user, process.env.SECRET_TOKEN, {
          expiresIn: "1h",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
          })
          .send({ success: true });
      } catch (error) {
        console.log(error);
      }
    });

    // clear cookies token after logout----------------
    app.post("/api/v1/logout", async (req, res) => {
      try {
        const user = req.body;
        console.log("looging out ", user);
        res.clearCookie("token", { maxAge: 0 }).send({ success: true });
      } catch (error) {
        console.log(error);
      }
    });

    // users api stat from here-----------------------------
    // get the total data of website----------------------

    const foodsCollection = client.db("baresto").collection("foods");
    const userFoodsCollection = client.db("baresto").collection("usersFood");

    app.get("/api/v1/foodsCount", async (req, res) => {
      try {
        const count = await foodsCollection.estimatedDocumentCount();
        res.send({ count });
      } catch (error) {
        console.log(error);
      }
    });

    // get all items of  the website------------------
    app.get("/api/v1/allfoods", async (req, res) => {
      try {
        let queryObj = {};
        let sortObj = {};
        const sortField = req.query?.sortField;
        const sortOrder = req.query?.sortOrder;
        const category = req.query?.category;
        if (category) {
          queryObj.category = category;
        }

        if (sortField && sortOrder) {
          sortObj[sortField] = sortOrder;
        }

        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

        const cursor = foodsCollection
          .find(queryObj)
          .skip(page * limit)
          .limit(limit)
          .sort(sortObj);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get single food---------------------------------
    app.get("/api/v1/allfoods/:foodId", async (req, res) => {
      try {
        const id = req.params.foodId;
        const query = { _id: new ObjectId(id) };
        const result = await foodsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // add a item by user ------------------------
    app.post("/api/v1/additem", async (req, res) => {
      try {
        const data = req.body;
        const result = await foodsCollection.insertOne(data);
        res.send(result);
        console.log(data);
      } catch (error) {
        console.log(error);
      }
    });

    //getting users added items------------------
    app.get("/api/v1/useritem", verifyToken, async (req, res) => {
      try {
        let query = {};
        const queryEmail = req.query?.email;
        const tokenEmail = req.user?.email;
        if (queryEmail !== tokenEmail) {
          res.status(403).send({ message: "authentication failed" });
        }
        if (queryEmail) {
          query.email = queryEmail;
        }
        const result = await foodsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // storgig users orders ----------------------------
    app.post("/api/v1/userorders", async (req, res) => {
      try {
        const data = req.body;
        const result = await userFoodsCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get  a  users  ordercollection---------------------
    app.get("/api/v1/usersorderitems", verifyToken, async (req, res) => {
      try {
        let query = {};
        const queryEmail = req.query?.email;
        const tokenEmail = req.user.email;
        if (queryEmail !== tokenEmail) {
          res.status(403).send({ messsage: "authentication failed" });
        }
        if (queryEmail) {
          query.email = queryEmail;
        }
        const result = await userFoodsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.delete("/api/v1/cancelorders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userFoodsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Cafe server is running");
});

app.listen(port, () => {
  console.log(`Baresto Cafe running on server ${port}`);
});
