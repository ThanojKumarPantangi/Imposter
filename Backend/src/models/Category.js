import mongoose from 'mongoose';

const WordItemSchema = new mongoose.Schema({
  word: { type: String, required: true, trim: true },
  normalizedWord: { type: String, required: true, lowercase: true, trim: true },
  hint: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'EASY' },
  enabled: { type: Boolean, default: true }
}, { _id: false });

const CategorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  numericId: { type: Number, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  group: { type: String, default: 'GENERAL' },
  icon: { type: String, default: 'book' },
  iconKey: { type: String, default: 'book' },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  language: { type: String, default: 'en' },
  status: { type: String, enum: ['PUBLISHED', 'DRAFT', 'ARCHIVED'], default: 'PUBLISHED' },
  featured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  minPlayableWords: { type: Number, default: 10 },
  words: [WordItemSchema]
}, {
  timestamps: true
});

const Category = mongoose.model('Category', CategorySchema);
export default Category;
