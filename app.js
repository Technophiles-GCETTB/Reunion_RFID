require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const MongoStore     = require('connect-mongo');
const methodOverride = require('method-override');
const path           = require('path');
const connectDB      = require('./config/db');
const { attachLocals } = require('./middlewares/auth');

const app = express();

// Connect DB
connectDB();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override (for PUT/DELETE from forms)
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret:            process.env.SESSION_SECRET || 'secret',
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    maxAge:   parseInt(process.env.SESSION_MAX_AGE) || 86400000,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production'
  }
}));

// Attach session data to all views
app.use(attachLocals);

// Routes
app.use('/api',    require('./routes/api'));
app.use('/admin',  require('./routes/admin'));

// Root redirect
app.get('/', (req, res) => res.redirect('/admin/dashboard'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: '404', message: 'Page not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'Error', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
});
