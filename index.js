const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_KEY);

// auto
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 5000;

// // middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
    ],
    credentials: true
}));
app.use(express.json());
// app.use(cookieParser());


// middlewares 
// const logger = (req, res, next) => {
//     console.log('log: info', req.method, req.url);
//     next();
// }





// const cookieOptions = {
//     httpOnly: true,
//     sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
//     secure: process.env.NODE_ENV === "production" ? true : false,

// };




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vdildbx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)

        await client.connect();
        const userCollection = client.db('bloodDonationDB').collection('users');
        const donorCollection = client.db('bloodDonationDB').collection('allDonor');
        const appointmentCollection = client.db('bloodDonationDB').collection('appointmentDoctor');
        const paymentsCollection = client.db('bloodDonationDB').collection('payments');

        // admin related 
        const verifyToken = (req, res, next) => {
            console.log('inside toktok ', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }
        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });

            }
            next();
        }

        // verify Volunteer
        const verifyVolunteer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isVolunteer = user?.role === 'volunteer';
            if (!isVolunteer) {
                return res.status(403).send({ message: 'forbidden access' });

            }
            next();
        }
        // admin related


        // user related api
        app.get('/user', verifyToken, verifyAdmin, async (req, res) => {
            try {
                // console.log("Result:", req.headers); // Debugging
                const result = await userCollection.find().toArray();

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        });


        app.post('/user', async (req, res) => {
            const user = req.body;
            // duplicate email not granted;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        // make admin
        app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }

            }
            const updateCount = await userCollection.updateOne(query, updatedDoc);
            res.send(updateCount);

        })

        // make Volunteer
        // app.patch('/user/volunteer/:id', verifyToken, verifyVolunteer, async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const updatedDoc = {
        //         $set: {
        //             role: 'volunteer'
        //         }

        //     }
        //     const updateCount = await userCollection.updateOne(query, updatedDoc);
        //     res.send(updateCount);

        // })



        // user delete 
        app.delete('/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await userCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        })
        // admin check
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email }
            const result = await userCollection.findOne(query);
            let admin = false;
            if (result) {
                admin = result?.role === 'admin';
            }
            res.send({ admin });
        })


         // volunteer check
         app.get('/user/volunteer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email }
            const result = await userCollection.findOne(query);
            let volunteer = false;
            if (result) {
                volunteer = result?.role === 'volunteer';
            }
            res.send({ volunteer });
        })






        // auth related api start,, logger
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });


            // res.send({token});.cookie('token', token, cookieOptions)

            // res
            //     .send({ success: true });
            res
                .send({ token });
        })

        // app.post('/logout', async (req, res) => {
        //     const user = req.body;
        //     console.log('logging out', user);
        //     res.clearCookie('token', { ...cookieOptions, maxAge: 0 }).send({ success: true })
        // })
        //auth related api end,






        // new last 3 data
        app.get('/allDonor', async (req, res) => {
            try {
                const result = await donorCollection.find().toArray();
                // console.log("Result:", result); // Debugging
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        });

        // one doctor loaded
        app.get('/allDonor/:id', async (req, res) => {
            try {
                const result = await donorCollection.findOne({ _id: new ObjectId(req.params.id) });
                // console.log("Result:", result); // Debugging
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        });
        // doctor add
        app.post('/allDonor', verifyToken, async (req, res) => {
            try {
                const doctorInfo = req.body;
                const result = await donorCollection.insertOne(doctorInfo);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }

        })
        // update doctor
        app.patch('/allDonor/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const doctorInfo = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: doctorInfo.name,
                    email: doctorInfo.email,
                    price: doctorInfo.price,
                    image: doctorInfo.image,
                    Specialty: doctorInfo.Specialty,
                    startTime: doctorInfo.startTime,
                    endTime: doctorInfo.endTime
                }

            }
            const updateCount = await donorCollection.updateOne(query, updatedDoc);
            res.send(updateCount);

        })

        // doctor delete 
        app.delete('/allDonor/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await donorCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        })



        // store appointment
        app.post('/bookAppointment', async (req, res) => {
            try {
                const appointment = req.body;
                const result = await appointmentCollection.insertOne(appointment);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }

        })

        // load appointment
        app.get('/bookAppointment', async (req, res) => {
            try {
                const email = req.query.email;
                const query = { patientEmail: email }
                const result = await appointmentCollection.find(query).toArray();
                // console.log("Result:", result); // Debugging
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        });

        // delete appointment
        app.delete('/appointment/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await appointmentCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        })


        // payment
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;

            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",

                payment_method_types: ['card']
                //     // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                //     automatic_payment_methods: {
                //         enabled: true,
                //     },
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;

            const paymentResult = await paymentsCollection.insertOne(payment);

            // 
            const query = {
                _id: {
                    $in: payment.appointmentIds.map(id => new ObjectId(id))
                }
            }

            const deleteResult=await appointmentCollection.deleteMany(query);
            // console.log('payment info', payment);
            res.send({paymentResult,deleteResult});
            console.log('payment info', paymentResult,deleteResult);

        })







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Final-Project is running')
})

app.listen(port, () => {
    console.log(`Final-Project is running on port ${port}`)
})