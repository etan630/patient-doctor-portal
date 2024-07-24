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
const methodOverride = require("method-override")

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
app.use(methodOverride("_method"))

// configuring the login post functionality
app.post("/login", checkNotAuthenticated, (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            return next(err)
        }
        if (!user) {
            req.flash('error', "Invalid email or password")
            return res.redirect("/login")
        }
        if (user.userType !== req.body.userRole) {
            // User role does not match the userType
            req.flash('error', "Login doesn't exist under user type")
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
    })(req, res, next)
})

// configuring the register post functionality
app.post("/register", checkNotAuthenticated, async (req, res) => {
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
app.get('/doctor', checkAuthenticated, (req, res) =>{
    res.render("doctor.ejs", {name: req.user.name})
})

app.get('/patient', checkAuthenticated, (req, res) => {
    res.render("patient.ejs", {name: req.user.name})
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render("login.ejs")
})

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render("register.ejs")
})

// End Routes

app.delete("/logout", (req, res, next) => {
    const userType = req.user ? req.user.userType : null;
    req.logout(err => {
        if (err) return next(err);
        if (userType === "doctor") {
            return res.redirect("/doctor");
        } else if (userType === "patient") {
            return res.redirect("/patient");
        } else {
            return res.redirect("/login");
        }
    });
})

function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()) {
        return next()
    }
    res.redirect("/login")
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()) {
        if (req.user.userType === "doctor") {
            return res.redirect("/doctor")
        } else if (req.user.userType === "patient") {
            return res.redirect("/patient")
        }
    }
    next()
}

app.listen(3000)