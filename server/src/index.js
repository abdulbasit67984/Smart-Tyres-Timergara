// require('dotenv').config({path: './env'})
import dotenv from 'dotenv'
import connectDB from './db/index.js'
import express from 'express'
import { app } from './app.js'
// import { initWhatsapp } from './services/whatsapp.service.js'
import { User } from './models/user.model.js'
// import "./schedulers/whatsappScheduler.js";


dotenv.config({
    path: './.env'
})

// const app = express()

const port = process.env.PORT || 8000

const ensureDefaultAdminUser = async () => {
    const userCount = await User.countDocuments();
    if (userCount > 0) return;

    await User.create({
        username: "basit",
        firstname: "Basit",
        password: "basit1234",
        role: "admin"
    });

    console.log("Default admin user created: basit");
}

connectDB()
.then(async () => {
    try {
        await ensureDefaultAdminUser();
    } catch (error) {
        console.log("Default admin user creation failed: " + error);
    }
    app.listen(
        port, 
        () => {
            console.log(`server is running on ${port}`)
            // initWhatsapp();
        }
    )
    // app.listen(port, '0.0.0.0', () => {
    //     console.log(`server is running on ${port}`)
    //         initWhatsapp();
    // })
})
.catch((error) => {
    console.log("DB connection error: " + error)
})