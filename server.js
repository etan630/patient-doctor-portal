if (process.env.NODE_ENV !== "production") {
    require("dotenv").config()
}

// Important Libraries
const express = require("express")
const app = express()
const bcrypt = require("bcrypt") // importing bcrypt package
const passport = require("passport")
const initializePassport = require("./passport-config")
const flash = require("express-flash")
const session = require("express-session")

initializePassport(
    passport, 
    email => users.find(user => user.email == email),
    id => users.find(user => user.id === id) 
    )

const users = []

app.use(express.urlencoded({extended: false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, // won't resave the session wariable if nothing is changed
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

// configuring the login post functionality
app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            return next(err)
        }
        if (!user) {
            return res.redirect("/login")
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err)
            }
            if (user.userType === "doctor") {
                return res.redirect("/doctor")
            } else if (user.userType === "patient") {
                return res.redirect("/patient")
            } else {
                return res.redirect("/login")
            }
        })
    }) (req, res, next)
})

// configuring the register post functionality
app.post("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        users.push({
            id: Date.now().toString(), // ensures same name ppl won't mess things up
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            userType: req.body.userRole,
        })
        console.log(users); //display newly registered in the console
        res.redirect("/login")
    } catch (e) {
        console.log(e);
        res.redirect("/register")
    }
})

// Routes
app.get('/doctor', (req, res) =>{
    res.render("doctor.ejs")
})

app.get('/login', (req, res) => {
    res.render("login.ejs")
})

app.get('/register', (req, res) => {
    res.render("register.ejs")
})

app.get('/patient', (req, res) => {
    res.render("patient.ejs")
})
// End Routes


app.listen(3000)