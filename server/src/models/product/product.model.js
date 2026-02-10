import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    productCode: {
        type: String
    },
    productName: {
        type: String,
        required: true
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category'
    },
    typeId: {
        type: Schema.Types.ObjectId,
        ref: 'Type'
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    productExpiryDate: {
        type: Date
    },
    salePricesId: {
        type: Schema.Types.ObjectId,
        ref: 'SalePrice'
    },
    vendorSupplierId: {
        type: Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    vendorCompanyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    productDiscountPercentage: {
        type: Number,
        default: 0
    },
    productPack: {
        type: Number,
        default: 1
    },
    productUnit: {
        type: Number
    },
    productPurchasePrice: {
        type: Number,
        required: true
    },
    quantityUnit: {
        type: String,
        enum: ['pcs', 'cotton', 'box', 'pack', 'kg', 'ton','meter', 'yard','ft'],
        default: 'pcs'
    },
    packUnit: {
        type: String,
        enum: ['pcs', 'kg', 'grams', 'ft', 'inches', 'cm'],
        default: 'pcs'
    },
    status: {
        type: Boolean
    },
    productTotalQuantity: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
})

ProductSchema.statics.allocatePurchasePrice = async function (productId, requiredQuantity, billItemPack, itemUnits, transaction) {
    const StatusOfPrice = mongoose.model('StatusOfPrice');

    const statusRecords = await StatusOfPrice.find({
        productId: productId,
    }).sort({ createdAt: 1 });

    // console.log('itemUnits', itemUnits)
    
    const quantityWithUnits = Number(requiredQuantity) * Number(billItemPack) + Number(itemUnits);
    let remainingRequiredQuantity = quantityWithUnits;

    const product = await this.findById(productId, 'productPack productPurchasePrice');
    if (!product) {
        throw new Error(`Product not found for ID: ${productId}`);
    }

    const productPack = Number(product.productPack) || 1;
    const purchasePrice = Number(product.productPurchasePrice) || 0;

    // Calculate total purchase cost directly from the product's purchase price
    let totalCost = (purchasePrice / productPack) * Number(quantityWithUnits) 
    // console.log('productPack', product.productPack)

    for (const record of statusRecords) {
        if (remainingRequiredQuantity <= 0) break;

        const usedQuantity = record.remainingQuantity <= 0 ? 0 : Math.min(record.remainingQuantity, remainingRequiredQuantity);
        // console.log('usedQuantity', usedQuantity)
        // console.log('statusRecords', statusRecords)
        
        remainingRequiredQuantity -= usedQuantity;
        
        const originalRemainingQuantity = record.remainingQuantity;
        record.remainingQuantity -= usedQuantity;
        
        transaction.addOperation(
            async () => await record.save(),
            async () => {
                record.remainingQuantity = originalRemainingQuantity;
                await record.save();
            }
        );
        // console.log('totalCost', totalCost)
    }

    // Handle negative stock by creating a virtual negative entry
    if (remainingRequiredQuantity > 0 && statusRecords.length > 0) {
        const lastRecord = statusRecords[statusRecords.length - 1];
        const originalRemainingQuantity = lastRecord.remainingQuantity;
        lastRecord.remainingQuantity -= remainingRequiredQuantity;

        transaction.addOperation(
            async () => await lastRecord.save(),
            async () => {
                lastRecord.remainingQuantity = originalRemainingQuantity;
                await lastRecord.save();
            }
        );
    }

    return Number(totalCost);
};


ProductSchema.statics.calculatePurchasePriceForReturn = async function (productId, returnedQuantity) {
    const StatusOfPrice = mongoose.model('StatusOfPrice'); // Reference the StatusOfPrice model

    // Fetch the first relevant StatusOfPrice record with remainingQuantity > 0
    let statusRecord;
    statusRecord = await StatusOfPrice.findOne({
        productId: productId,
        remainingQuantity: { $gt: 0 }
    }).sort({ createdAt: 1 });

    if (!statusRecord) {
        statusRecord = await StatusOfPrice.findOne({
            productId: productId
        }).sort({ createdAt: -1 });
    }

    if (statusRecord) {
        statusRecord.remainingQuantity += Number(returnedQuantity);
        await statusRecord.save();
    }

    const product = await this.findById(productId, 'productPack productPurchasePrice');
    if (!product) {
        throw new Error(`Product not found for ID: ${productId}`);
    }

    const productPack = Number(product.productPack) || 1;
    const purchasePrice = Number(product.productPurchasePrice) || 0;

    // Calculate the total purchase price for the returned quantity from product purchase price
    const totalCost = (Number(returnedQuantity) * purchasePrice) / productPack;
    return Number(totalCost);
};


export const Product = mongoose.model("Product", ProductSchema);