import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { env, validateEnv } from '../src/config/env.js';
import User from '../src/models/User.js';
import Item from '../src/models/Item.js';
import Claim from '../src/models/Claim.js';

async function run() {
  validateEnv();
  if (env.nodeEnv === 'production') throw new Error('Demo seeding disabled in production');
  await connectDb();
  const password = process.env.SEED_DEFAULT_PASSWORD || '';
  if (password.length < 8) throw new Error('SEED_DEFAULT_PASSWORD must be 8 or more characters');
  const members = [
    { name: 'Campus Admin', email: 'admin@campus.edu', role: 'admin' },
    { name: 'Security Officer', email: 'security@campus.edu', role: 'moderator' },
    { name: 'Sara Khan', email: 'sara@campus.edu', role: 'user' },
    { name: 'Ahmed Raza', email: 'ahmed@campus.edu', role: 'user' }
  ];
  const accounts = {};
  for (const member of members) {
    const hash = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate({ email: member.email }, { $setOnInsert: { ...member, passwordHash: hash } }, { upsert: true, new: true, runValidators: true });
    accounts[member.email] = user;
  }
  const examples = [
    { title: 'Black Sony wireless earbuds', description: 'Found black Sony earbuds inside a small charging case near the front desk.', category: 'Electronics', location: 'Main Library', type: 'found', reporter: accounts['sara@campus.edu']._id, date: new Date(Date.now() - 86400_000) },
    { title: 'Scientific calculator Casio fx-991', description: 'Lost a grey Casio scientific calculator with a small star mark on the cover.', category: 'Electronics', location: 'Computer Science Block', type: 'lost', reporter: accounts['ahmed@campus.edu']._id, date: new Date(Date.now() - 2 * 86400_000) },
    { title: 'University ID card', description: 'Found an ID card with a blue lanyard after the morning lecture. Please provide your details privately.', category: 'Documents', location: 'Academic Block A', type: 'found', reporter: accounts['security@campus.edu']._id, date: new Date() },
    { title: 'Silver key ring', description: 'A set of three keys with a small basketball keychain went missing during class.', category: 'Keys', location: 'Academic Block B', type: 'lost', reporter: accounts['sara@campus.edu']._id, date: new Date() },
    { title: 'Blue backpack', description: 'A navy blue backpack with two exterior side pockets was found near the bus stop.', category: 'Bags', location: 'Main Gate', type: 'found', reporter: accounts['ahmed@campus.edu']._id, date: new Date() }
  ];
  for (const [index, item] of examples.entries()) {
    item.reporterName = (await User.findById(item.reporter)).name;
    item.registrationNumber = `SP24-BCS-${String(index + 1).padStart(3, '0')}`;
    const existing = await Item.findOne({ title: item.title, reporter: item.reporter });
    if (!existing) await Item.create(item);
  }
  const found = await Item.findOne({ title: 'Black Sony wireless earbuds' });
  const claimant = accounts['ahmed@campus.edu'];
  if (!await Claim.exists({ item: found.id, claimant: claimant.id })) {
    await Claim.create({ item: found.id, claimant: claimant.id, proofText: 'The case has a tiny scratch on its left hinge and my initials on the bottom.' });
    found.status = 'claim_pending'; await found.save();
  }
  console.log('\nDemo data ready. Sample logins:');
  for (const { email, role } of members) console.log(`  ${role.padEnd(10)} ${email}`);
  console.log('Password comes from SEED_DEFAULT_PASSWORD in your local .env (do not use demo accounts in production).');
}
run().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => mongoose.disconnect());
