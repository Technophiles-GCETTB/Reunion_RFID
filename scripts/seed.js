require('dotenv').config();
const mongoose  = require('mongoose');
const Admin     = require('../models/Admin');
const Person    = require('../models/Person');
const Zone      = require('../models/Zone');
const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  await Admin.deleteMany({});
  await Person.deleteMany({});
  await Zone.deleteMany({});

  // Admins
  await Admin.create([
    { name:'Super Admin', email:'superadmin@reunion.edu', password:'superadmin123', role:'superadmin' },
    { name:'Event Admin', email:'admin@reunion.edu',      password:'admin123',      role:'admin'      }
  ]);
  console.log('✅ Admins created');
  console.log('   superadmin@reunion.edu / superadmin123');
  console.log('   admin@reunion.edu / admin123');

  // Zones
  await Zone.create([
    { code:'entry',    name:'Entry Gate',     icon:'🚪', color:'#3b82f6', defaultLimit:1, defaultAllowed:true,  description:'Main entry gate scanner', isActive:true },
    { code:'food',     name:'Food Zone',      icon:'🍽️', color:'#10b981', defaultLimit:2, defaultAllowed:true,  description:'Meal and refreshment counter', isActive:true },
    { code:'cultural', name:'Cultural Stage', icon:'🎭', color:'#8b5cf6', defaultLimit:1, defaultAllowed:true,  description:'Cultural program auditorium', isActive:true },
    { code:'vip',      name:'VIP Lounge',     icon:'⭐', color:'#f59e0b', defaultLimit:1, defaultAllowed:false, description:'Restricted VIP area', isActive:true }
  ]);
  console.log('✅ Zones created: entry, food, cultural, vip');

  // Persons
  const alumni1 = await Person.create({
    name:'Dr. Arjun Mehta', phone:'9876543210', type:'alumni', status:'active',
    permissions:{
      food:     {allowed:true,  limit:3, used:0},
      cultural: {allowed:true,  limit:2, used:0},
      vip:      {allowed:true,  limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:0}
    },
    meta:{address:'12 Park Street, Mumbai', notes:'Distinguished alumni, Batch 1995'}
  });
  const alumni2 = await Person.create({
    name:'Priya Sharma', phone:'9123456789', type:'alumni', status:'active',
    permissions:{
      food:     {allowed:true,  limit:2, used:1},
      cultural: {allowed:true,  limit:1, used:0},
      vip:      {allowed:false, limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:1}
    },
    meta:{address:'45 MG Road, Bangalore', notes:'Batch 2003'}
  });
  const teacher1 = await Person.create({
    name:'Prof. Raghavendra Nair', phone:'9988776655', type:'teacher', status:'active',
    permissions:{
      food:     {allowed:true, limit:3, used:0},
      cultural: {allowed:true, limit:2, used:0},
      vip:      {allowed:true, limit:2, used:0},
      entry:    {allowed:true, limit:2, used:0}
    },
    meta:{address:'Faculty Quarters, Campus', notes:'HOD, Computer Science'}
  });
  const student1 = await Person.create({
    name:'Rahul Das', phone:'8765432109', type:'student', status:'active',
    permissions:{
      food:     {allowed:true,  limit:2, used:0},
      cultural: {allowed:true,  limit:1, used:0},
      vip:      {allowed:false, limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:0}
    },
    meta:{address:'Boys Hostel, Block C', notes:'Final year student'}
  });
  const student2 = await Person.create({
    name:'Sneha Roy', phone:'7654321098', type:'student', status:'active',
    card:{version:2, isBlocked:false, pendingUpgrade:false},
    permissions:{
      food:     {allowed:true,  limit:2, used:0},
      cultural: {allowed:true,  limit:1, used:0},
      vip:      {allowed:false, limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:0}
    },
    meta:{address:'Girls Hostel, Block A', notes:'Card upgraded - had lost previous card'}
  });
  const guest1 = await Person.create({
    name:'Vikram Mehta', phone:'6543210987', type:'guest', broughtBy:alumni1._id, status:'active',
    permissions:{
      food:     {allowed:true,  limit:2, used:0},
      cultural: {allowed:true,  limit:1, used:0},
      vip:      {allowed:false, limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:0}
    },
    meta:{address:'Mumbai', notes:'Spouse of Dr. Arjun Mehta'}
  });
  const blocked = await Person.create({
    name:'Amit Kumar', phone:'5432109876', type:'alumni', status:'active',
    card:{version:1, isBlocked:true, pendingUpgrade:true},
    permissions:{
      food:     {allowed:true,  limit:2, used:0},
      cultural: {allowed:true,  limit:1, used:0},
      vip:      {allowed:false, limit:1, used:0},
      entry:    {allowed:true,  limit:1, used:0}
    },
    meta:{notes:'Card reported lost - pending upgrade approval'}
  });
  await Person.findByIdAndUpdate(alumni1._id, { $push: { guests: guest1._id } });

  console.log('✅ Persons created:');
  console.log(`   Alumni  — ${alumni1.name}  (ID: ${alumni1._id})`);
  console.log(`   Alumni  — ${alumni2.name}  (ID: ${alumni2._id})`);
  console.log(`   Teacher — ${teacher1.name} (ID: ${teacher1._id})`);
  console.log(`   Student — ${student1.name} (ID: ${student1._id})`);
  console.log(`   Student — ${student2.name} (ID: ${student2._id})`);
  console.log(`   Guest   — ${guest1.name}   (ID: ${guest1._id})`);
  console.log(`   Blocked — ${blocked.name}  (ID: ${blocked._id}) [PENDING UPGRADE]`);

  console.log('\n🚀 Seed complete! Run: npm start');
  console.log('📊 Admin: http://localhost:3000/admin');
  process.exit(0);
};
seed().catch(err => { console.error(err); process.exit(1); });
