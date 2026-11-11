const { AppError } = require('../middleware/errorHandler');

const VALID_UNITS = ['KG', 'GRAM', 'PIECE'];

function roundQty(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getBaseUnit(unit) {
  if (!VALID_UNITS.includes(unit)) {
    throw new AppError(`Invalid unit: ${unit}. Supported units: KG, GRAM, PIECE.`, 400);
  }
  return unit === 'PIECE' ? 'PIECE' : 'KG';
}

function validateUnitCompatibility(itemUnit, vegetableBaseUnit) {
  const derivedBase = getBaseUnit(itemUnit);
  if (derivedBase !== vegetableBaseUnit) {
    throw new AppError(
      `Unit ${itemUnit} is incompatible with vegetable base unit ${vegetableBaseUnit}.`,
      400
    );
  }
}

function toBaseQuantity(quantity, unit, vegetableBaseUnit = null) {
  const num = Number(quantity);
  if (!Number.isFinite(num) || num <= 0) {
    throw new AppError('Quantity must be greater than zero.', 400);
  }
  const derivedBase = getBaseUnit(unit);
  if (vegetableBaseUnit && derivedBase !== vegetableBaseUnit) {
    throw new AppError(
      `Unit ${unit} is incompatible with vegetable base unit ${vegetableBaseUnit}.`,
      400
    );
  }
  if (unit === 'GRAM') {
    return roundQty(num / 1000);
  }
  return roundQty(num);
}

function fromBaseQuantity(baseQty, targetUnit) {
  const num = Number(baseQty);
  if (targetUnit === 'GRAM') {
    return roundQty(num * 1000);
  }
  return roundQty(num);
}

/**
 * Computes price per base_unit from vegetable's selling_price, pack_size, and unit.
 * Example:
 *  - Rs 40 per 1 KG -> base_unit_price = 40.00 / KG
 *  - Rs 18 per 250 GRAM -> pack base = 0.250 KG -> base_unit_price = 72.00 / KG
 *  - Rs 35 per 1 PIECE -> base_unit_price = 35.00 / PIECE
 */
function computeBaseUnitPrice(sellingPrice, packSize, unit) {
  const price = Number(sellingPrice);
  const packBase = toBaseQuantity(packSize || 1, unit);
  if (packBase <= 0) {
    throw new AppError('Pack size must be greater than zero.', 400);
  }
  return roundMoney(price / packBase);
}

function computeOrderLinePricing(vegetable, quantity, requestedUnit) {
  const unit = requestedUnit || vegetable.unit;
  validateUnitCompatibility(unit, vegetable.base_unit);
  const baseQty = toBaseQuantity(quantity, unit, vegetable.base_unit);
  const packBaseQty = toBaseQuantity(vegetable.pack_size || 1, vegetable.unit, vegetable.base_unit);
  // Exact line total from pack ratio to avoid rounding drift on GRAM packs
  const lineTotal = roundMoney((baseQty / packBaseQty) * Number(vegetable.selling_price));
  const baseUnitPrice = roundMoney(Number(vegetable.selling_price) / packBaseQty);
  return {
    unit,
    quantity: roundQty(quantity),
    baseQuantity: baseQty,
    baseUnit: vegetable.base_unit,
    baseUnitPrice,
    lineTotal,
  };
}

function computePurchaseCostPerBaseUnit(unitCost, unit, baseUnit) {
  validateUnitCompatibility(unit, baseUnit);
  const cost = Number(unitCost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new AppError('Purchase unit cost cannot be negative.', 400);
  }
  if (unit === 'GRAM') {
    return roundMoney(cost * 1000);
  }
  return roundMoney(cost);
}

module.exports = {
  VALID_UNITS,
  roundQty,
  roundMoney,
  getBaseUnit,
  validateUnitCompatibility,
  toBaseQuantity,
  fromBaseQuantity,
  computeBaseUnitPrice,
  computeOrderLinePricing,
  computePurchaseCostPerBaseUnit,
};
