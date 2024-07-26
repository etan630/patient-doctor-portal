if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// Important Libraries
const express = require("express");
const app = express();
const bcrypt = require("bcrypt"); // importing bcrypt package
const passport = require("passport");
const initializePassport = require("./passport-config");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { v4: uuidv4 } = require('uuid'); // To generate unique IDs

initializePassport(
    passport,
    email => users.find(user => user.email == email),
    id => users.find(user => user.id === id)
);

const users = [];

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, // won't resave the session variable if nothing is changed
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.set('view engine', 'ejs');

// In-memory data storage
let patients = [];
let doctors = [];
let distributors = [];

// Patient Routes
app.post('/patient/request-refill', (req, res) => {
    const { name, prescription, quantity, distributor } = req.body;
    let patient = patients.find(p => p.name === name);

    if (!patient) {
        patient = { name, requests: [], healthRecord: {} };
        patients.push(patient);
    }

    patient.requests.push({ id: uuidv4(), prescription, quantity, distributor, status: 'Not Seen' });
    res.redirect('/patient');
});

app.post('/patient/update-health-record', (req, res) => {
    const { name, age, weight, height, gender, allergies } = req.body;
    let patient = patients.find(p => p.name === name);

    if (!patient) {
        patient = { name, requests: [], healthRecord: {} };
        patients.push(patient);
    }

    patient.healthRecord = { age, weight, height, gender, allergies };
    res.redirect('/patient');
});

// Doctor Routes
app.post('/doctor/manage-patients', (req, res) => {
    const { doctorId, patientIds } = req.body;
    let doctor = doctors.find(d => d.id === doctorId);

    if (doctor) {
        const patientIdsArray = Array.isArray(patientIds) ? patientIds : [patientIds];
        doctor.patients = patientIdsArray.map(id => patients.find(p => p.name === id));
        res.redirect('/doctor');
    } else {
        res.status(404).send('Doctor not found');
    }
});

app.post('/doctor/update-request-status', (req, res) => {
    const { requestId, status, patientName } = req.body;
    let patient = patients.find(p => p.name === patientName);

    if (patient) {
        let request = patient.requests.find(r => r.id === requestId);
        if (request) {
            request.status = status;
            res.redirect('/doctor');
        } else {
            res.status(404).send('Request not found');
        }
    } else {
        res.status(404).send('Patient not found');
    }
});

app.post('/doctor/add-distributor', (req, res) => {
    const { name, address, phone, email, contactPerson } = req.body;
    distributors.push({ name, address, phone, email, contactPerson });
    res.redirect('/doctor');
});

// Render pages
app.get('/doctor', checkAuthenticated, (req, res) => {
    const doctor = doctors.find(d => d.id === req.user.id);
    const managedPatients = doctor ? doctor.patients : [];

    const allRequests = managedPatients.flatMap(p => 
        p.requests.map(r => ({ ...r, patientName: p.name }))
    );

    res.render('doctor', {
        name: req.user.name,
        doctorId: req.user.id,
        patients: managedPatients,
        allPatients: patients,
        distributors: distributors,
        allRequests: allRequests
    });
});

app.get('/patient', checkAuthenticated, (req, res) => {
    res.render('patient', { name: req.user.name, patients });
});

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render("login.ejs");
});

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render("register.ejs");
});

// configuring the login post functionality
app.post("/login", checkNotAuthenticated, (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error', "Invalid email or password");
            return res.redirect("/login");
        }
        if (user.userType !== req.body.userRole) {
            // User role does not match the userType
            req.flash('error', "Login doesn't exist under user type");
            return res.redirect("/login");
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            if (user.userType === "doctor") {
                return res.redirect("/doctor");
            } else if (user.userType === "patient") {
                return res.redirect("/patient");
            } else {
                return res.redirect("/login");
            }
        });
    })(req, res, next);
});

// configuring the register post functionality
app.post("/register", checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        users.push({
            id: Date.now().toString(), // ensures same name ppl won't mess things up
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            userType: req.body.userRole,
        });
        if (req.body.userRole === "doctor") {
            doctors.push({ id: Date.now().toString(), name: req.body.name, patients: [] });
        }
        console.log(users); //display newly registered in the console
        res.redirect("/login");
    } catch (e) {
        console.log(e);
        res.redirect("/register");
    }
});

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
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.userType === "doctor") {
            return res.redirect("/doctor");
        } else if (req.user.userType === "patient") {
            return res.redirect("/patient");
        }
    }
    next();
}

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
