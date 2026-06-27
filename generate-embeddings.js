// ============================================================
// ZEWAR BOUTIQUE — One-off Embedding Backfill Script
// Run once:  node generate-embeddings.js
// Re-run is safe (idempotent — overwrites existing embeddings).
// ============================================================
require('dotenv').config();
const dns = require('dns');
// Force Google DNS for mobile hotspots/unreliable carrier DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Config ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const EMBEDDING_MODEL = 'gemini-embedding-2'; // 768 dimensions

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.error('❌ GEMINI_API_KEY is not set in .env — please add your key.');
    process.exit(1);
}

// --- Mongoose Schema (mirrors server.js) ---
const productSchema = new mongoose.Schema({
    id: String, title: String, sku: String, price: Number, costPrice: Number,
    discountPrice: Number, stock: Number, category: String, description: String,
    images: [String], image: String,
    descriptionEmbedding: [Number]
}, { strict: false });

const Product = mongoose.model('Product', productSchema);

// --- Build text for embedding ---
function buildEmbeddingText(product) {
    const parts = [
        product.title || '',
        product.category ? `Category: ${product.category}` : '',
        product.description || '',
        product.price ? `Price: ₹${product.price}` : '',
        product.discountPrice ? `Sale Price: ₹${product.discountPrice}` : ''
    ];
    return parts.filter(Boolean).join('. ').trim();
}

// --- Main ---
async function main() {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.\n');

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const products = await Product.find();
    console.log(`📦 Found ${products.length} products. Starting embedding generation...\n`);

    if (products.length === 0) {
        console.log('⚠️  No products in the database. Add some products first, then re-run this script.');
        await mongoose.disconnect();
        return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const text = buildEmbeddingText(p);

        try {
            const result = await embeddingModel.embedContent(text);
            const embedding = result.embedding.values;

            await Product.updateOne(
                { _id: p._id },
                { $set: { descriptionEmbedding: embedding } }
            );

            success++;
            console.log(`  [${i + 1}/${products.length}] ✅ ${p.title} (${embedding.length} dims)`);
        } catch (err) {
            failed++;
            console.error(`  [${i + 1}/${products.length}] ❌ ${p.title} — ${err.message}`);
        }

        // Small delay to respect rate limits
        if (i < products.length - 1) {
            await new Promise(r => setTimeout(r, 250));
        }
    }

    console.log(`\n🏁 Done! Embedded: ${success}  |  Failed: ${failed}`);
    console.log('\n📌 NEXT STEP: Create the Vector Search index in MongoDB Atlas dashboard.');
    console.log('   Index name: "product_embeddings"');
    console.log('   Field path: "descriptionEmbedding"');
    console.log('   Dimensions: 768  |  Similarity: cosine');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
