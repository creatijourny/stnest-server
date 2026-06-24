const express = require('express');
const dotenv = require('dotenv')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dotenv.config();
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization
  if(!authHeader) {
    return res.status(401).json({message:
      "Unauthorized"});
  }
  const token = authHeader.split(' ')[1]
  if(!token){
    return res.status(401).json({message:
      "Unauthorized"});
  }

  try {
    const {payload} = await jwtVerify(token, JWKS)
  console.log(payload)
  next()
  } catch (error) {
    return res.status(403).json({message: "Forbidden1"});
  }  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("studynest");
    const roomCollection = db.collection('rooms');
    const bookingCollection = db.collection('bookings')

    app.get('/room', async(req, res) => {
        const result = await roomCollection.find().toArray();
        res.json(result);
    });

    app.post('/room', async (req, res) => {
        const roomData = req.body
        console.log(roomData);
        const result = await roomCollection.insertOne(roomData)

        res.json(result);
    });

    app.get('/room/:id', async (req, res) => {
        const {id} = req.params

        const result = await roomCollection.findOne
        ({_id: new ObjectId(id)})

        res.json(result);
    });

    app.patch('/room/:id', async(req, res) => {
      const {id} = req.params
      const updatedData = req.body

      const result = await roomCollection.updateOne(
        {_id: new ObjectId(id)},
        {$set: updatedData}
      )

      res.json(result);
    })

    app.delete('/room/:id', async (req, res) => {
      const { id } = req.params;
      const result = await roomCollection.deleteOne({_id: new ObjectId(id)})
      res.json(result);
    })

    app.get('/booking/:userId', async (req, res) => {
      const {userId} = req.params;

      const result = await bookingCollection.find({userId: userId}).toArray();
      res.json(result);
    })    

    // conflict check start
    
    app.post("/booking", verifyToken, async (req, res) => {
  const booking = req.body;

  const existingBookings = await bookingCollection.find({
    roomId: booking.roomId,
    date: booking.date,
    status: "confirmed",
  }).toArray();

  const isBooked = existingBookings.some(existing => {

        const existingStart = Number(existing.startTime.split(":")[0]);
        const existingEnd = Number(existing.endTime.split(":")[0]);

        const newStart = Number(booking.startTime.split(":")[0]);
        const newEnd = Number(booking.endTime.split(":")[0]);

        return (
          newStart < existingEnd &&
          newEnd > existingStart
        );
        // console.log("Found bookings:", existingBookings);
      });
      

      if (isBooked) {
        return res.status(409).json({
          success: false,
          message: "This room is already booked for the selected time."
        });
      }

  const result = await bookingCollection.insertOne(booking);
  

  res.status(201).json({
    message: "Room booked successfully",
    result,
  });
});
// conflict check end


    app.delete('/booking/:bookingId', async (req, res) => {
      const { bookingId } = req.params;
      const result = await bookingCollection.deleteOne({_id: new ObjectId(bookingId)})

      res.json(result);
    })    

    
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Server is running fine!")
})


app.listen(PORT, () => {
    console.log(`Stnest server running on port ${PORT}`)
})