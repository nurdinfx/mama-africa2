import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  MenuItem,
  Card,
  CardContent,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import { Add, Delete, Close } from '@mui/icons-material';
import { getPurchaseApi } from '../../services/api';

const PurchaseForm = ({ initialData, onSave, onCancel }) => {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    supplierId: '',
    items: [{
      productId: '',
      qty: 1,
      unitCost: 0,
      discount: 0,
      tax: 0,
      total: 0
    }],
    paymentMethod: 'cash',
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([loadProducts(), loadSuppliers()]);
    } catch (error) {
      setError('Failed to load initial data');
      console.error('Initial data loading error:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const purchaseApi = getPurchaseApi();
      const response = await purchaseApi.getProducts();
      console.log('📦 Products API response:', response);
      
      let productsData = [];
      
      if (response && response.success) {
        if (Array.isArray(response.data)) {
          productsData = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          productsData = response.data.data;
        } else if (response.data && Array.isArray(response.data.products)) {
          productsData = response.data.products;
        } else if (Array.isArray(response)) {
          productsData = response;
        }
      }
      
      console.log('📦 Extracted products data:', productsData);
      
      if (!productsData || productsData.length === 0) {
        console.warn('⚠️ No products found, using demo data');
        productsData = [
          { _id: '1', name: 'Coffee', category: 'Drinks', cost: 0.7, price: 2.5, stock: 50 },
          { _id: '2', name: 'Tea', category: 'Drinks', cost: 0.5, price: 2.0, stock: 30 },
          { _id: '3', name: 'Sandwich', category: 'Food', cost: 2.0, price: 5.0, stock: 20 },
          { _id: '4', name: 'Cake', category: 'Food', cost: 1.5, price: 4.0, stock: 15 },
          { _id: '5', name: 'Water', category: 'Drinks', cost: 0.3, price: 1.0, stock: 100 }
        ];
      }
      
      const normalized = productsData.map((p, index) => ({
        _id: p._id || p.id || `demo-${index + 1}`,
        name: p.name || p.productName || 'Unnamed Product',
        category: p.category || 'General',
        cost: p.cost || p.costPrice || p.purchasePrice || 0,
        price: p.price || p.sellPrice || p.salePrice || 0,
        stock: p.stock || 0,
        isAvailable: p.isAvailable !== false
      }));
      
      console.log('✅ Normalized products:', normalized);
      setProducts(normalized);
      
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      const demoProducts = [
        { _id: '1', name: 'Coffee', category: 'Drinks', cost: 0.7, price: 2.5, stock: 50 },
        { _id: '2', name: 'Tea', category: 'Drinks', cost: 0.5, price: 2.0, stock: 30 },
        { _id: '3', name: 'Sandwich', category: 'Food', cost: 2.0, price: 5.0, stock: 20 }
      ];
      setProducts(demoProducts);
      setError('Using demo data - API connection failed');
    }
  };

  const loadSuppliers = async () => {
    try {
      const purchaseApi = getPurchaseApi();
      const response = await purchaseApi.getSuppliers();
      
      let suppliersData = [];
      
      if (response && response.success) {
        if (Array.isArray(response.data)) {
          suppliersData = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          suppliersData = response.data.data;
        } else if (response.data && Array.isArray(response.data.suppliers)) {
          suppliersData = response.data.suppliers;
        } else if (Array.isArray(response)) {
          suppliersData = response;
        }
      }
      
      const normalized = suppliersData.map((s, index) => ({
        _id: s._id || s.id || `supplier-${index + 1}`,
        name: s.name || s.companyName || 'Unknown Supplier'
      }));
      
      if (normalized.length === 0) {
        normalized.push(
          { _id: '1', name: 'Beverage Supplier Co.' },
          { _id: '2', name: 'Food Distributors Ltd.' }
        );
      }
      
      setSuppliers(normalized);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSuppliers([
        { _id: '1', name: 'Beverage Supplier Co.' },
        { _id: '2', name: 'Food Distributors Ltd.' }
      ]);
    }
  };

  const computeItemTotal = (item) => {
    const baseAmount = item.qty * item.unitCost;
    const discountAmount = baseAmount * (item.discount / 100);
    const taxAmount = (baseAmount - discountAmount) * (item.tax / 100);
    return Math.round((baseAmount - discountAmount + taxAmount) * 100) / 100;
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: '', qty: 1, unitCost: 0, discount: 0, tax: 0, total: 0 }
      ]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  // FIXED: Better updateItem function with proper state management
  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const updated = { ...newItems[index], [field]: value };
      const total = computeItemTotal(updated);
      newItems[index] = { ...updated, total };
      return { ...prev, items: newItems };
    });
  };

  // FIXED: Simple product finder
  const getProduct = (productId) => {
    if (!productId) return null;
    const foundProduct = products.find(p => p._id === productId);
    return foundProduct;
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.total || computeItemTotal(item)), 0);
  };

  // FIXED: Simple validation
  const isFormValid = useMemo(() => {
    if (!formData.supplierId) return false;
    
    return formData.items.every(item => {
      return item.productId && item.qty > 0 && item.unitCost > 0;
    });
  }, [formData.supplierId, formData.items]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const purchaseApi = getPurchaseApi();
      const payload = {
        supplierId: formData.supplierId,
        items: formData.items.map(it => ({
          productId: it.productId,
          qty: it.qty,
          unitCost: it.unitCost,
          discount: it.discount,
          tax: it.tax,
          total: it.total
        })),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        grandTotal: calculateGrandTotal()
      };

      console.log('📤 Submitting purchase:', payload);
      const response = await purchaseApi.createPurchase(payload);
      // Notify user if the purchase was queued for offline sync
      if (response && response.queued) {
        alert(response.message || 'Purchase queued for sync (offline)');
      }
      onSave(response.data);
    } catch (error) {
      console.error('❌ Failed to create purchase:', error);
      setError(error.response?.data?.message || 'Failed to create purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight="bold">
            Create New Purchase
          </Typography>
          <IconButton onClick={onCancel}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Error Alert */}
          {error && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            </Grid>
          )}

          {/* Header Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Purchase Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      options={suppliers}
                      getOptionLabel={(option) => option.name}
                      value={suppliers.find(s => s._id === formData.supplierId) || null}
                      onChange={(_, value) => {
                        console.log('🏢 Supplier selected:', value);
                        setFormData(prev => ({ 
                          ...prev, 
                          supplierId: value ? value._id : '' 
                        }));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Supplier *"
                          required
                          error={!formData.supplierId}
                          helperText={!formData.supplierId ? 'Supplier is required' : ''}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      label="Payment Method *"
                      value={formData.paymentMethod}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))
                      }
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="credit">Credit</MenuItem>
                      <MenuItem value="bank">Bank Transfer</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Items Table */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Purchase Items ({products.length} products available)
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={addItem}
                    variant="outlined"
                  >
                    Add Item
                  </Button>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product *</TableCell>
                        <TableCell>Quantity *</TableCell>
                        <TableCell>Unit Cost *</TableCell>
                        <TableCell>Discount %</TableCell>
                        <TableCell>Tax %</TableCell>
                        <TableCell>Total</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.items.map((item, index) => {
                        const currentProduct = getProduct(item.productId);
                        

                        return (
                          <TableRow key={index}>
                            <TableCell sx={{ width: '300px' }}>
                              {/* FIXED: Autocomplete with better state management */}
                              <Autocomplete
                                options={products}
                                getOptionLabel={(option) => 
                                  `${option.name} (${option.category}) - $${option.cost}`
                                }
                                // FIXED: Use the actual product object as value
                                value={currentProduct}
                                // FIXED: Better onChange handler
                                onChange={(_, newValue) => {
                                  if (newValue) {
                                    updateItem(index, 'productId', newValue._id);
                                    updateItem(index, 'unitCost', newValue.cost || 0);
                                  } else {
                                    // Clear selection if null
                                    updateItem(index, 'productId', '');
                                    updateItem(index, 'unitCost', 0);
                                  }
                                }}
                                // FIXED: Add isOptionEqualToValue to prevent re-render issues
                                isOptionEqualToValue={(option, value) => 
                                  !!value && option._id === value._id
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    placeholder="Select product"
                                    error={!item.productId}
                                    helperText={!item.productId ? 'Product selection is required' : ''}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={item.qty}
                                onChange={(e) => updateItem(index, 'qty', Math.max(1, Number(e.target.value)))}
                                sx={{ width: 80 }}
                                error={!item.qty || item.qty <= 0}
                                inputProps={{ min: 1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={item.unitCost}
                                onChange={(e) => updateItem(index, 'unitCost', Math.max(0, Number(e.target.value)))}
                                sx={{ width: 100 }}
                                error={!item.unitCost || item.unitCost <= 0}
                                inputProps={{ min: 0, step: 0.01 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={item.discount}
                                onChange={(e) => updateItem(index, 'discount', Math.max(0, Number(e.target.value)))}
                                sx={{ width: 80 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={item.tax}
                                onChange={(e) => updateItem(index, 'tax', Math.max(0, Number(e.target.value)))}
                                sx={{ width: 80 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                ${(item.total || 0).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => removeItem(index)}
                                color="error"
                                disabled={formData.items.length === 1}
                              >
                                <Delete />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Totals and Notes */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      value={formData.notes}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Enter any additional notes..."
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h4" color="primary" gutterBottom>
                        Grand Total: ${calculateGrandTotal().toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formData.items.length} item(s) | {products.length} products available
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onCancel} size="large" disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isFormValid}
          size="large"
          sx={{ minWidth: 150 }}
        >
          {loading ? 'Creating...' : 'Submit Purchase'}
        </Button>
      </DialogActions>
    </>
  );
};

export default PurchaseForm;
