import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Dialog,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Add,
  Edit,
  Visibility,
  Search,
  FilterList,
  Refresh
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PurchaseForm from './PurchaseForm';
import { getPurchaseApi } from '../../services/api';
import { formatDate } from '../../utils/date';

const PurchaseProducts = ({ onStatsUpdate }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    fromDate: '',
    toDate: ''
  });

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    setLoading(true);
    setError('');
    try {
      const purchaseApi = getPurchaseApi();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.fromDate) params.from = filters.fromDate;
      if (filters.toDate) params.to = filters.toDate;

      const response = await purchaseApi.getPurchases(params);
      console.log('Purchases API response:', response);
      
      // FIXED: Handle different response structures
      let purchasesData = [];
      
      if (response.data && Array.isArray(response.data)) {
        purchasesData = response.data;
      } else if (response.data && response.data.purchases && Array.isArray(response.data.purchases)) {
        purchasesData = response.data.purchases;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        purchasesData = response.data.data;
      } else if (Array.isArray(response)) {
        purchasesData = response;
      }
      
      console.log('Extracted purchases:', purchasesData);

      const normalized = purchasesData.map(p => ({
        _id: p._id || p.id || String(Date.now() + Math.random()),
        supplierId: p.supplierId || p.supplier?._id,
        supplier: p.supplier || { 
          name: p.supplierName || p.supplierId?.name || 'N/A',
          _id: p.supplierId || p.supplier?._id 
        },
        items: Array.isArray(p.items) ? p.items.map(item => ({
          ...item,
          product: item.product || item.productId,
          productName: item.productName || item.product?.name || 'Unknown Product'
        })) : [],
        grandTotal: p.grandTotal ?? p.total ?? 0,
        subtotal: p.subtotal || 0,
        taxTotal: p.taxTotal || 0,
        discountTotal: p.discountTotal || 0,
        status: p.status || 'draft',
        paymentMethod: p.paymentMethod || 'cash',
        createdBy: p.createdBy || 'System',
        notes: p.notes || '',
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
        ...p
      }));
      
      setPurchases(normalized);
      
      // Update stats if callback provided
      if (onStatsUpdate) {
        onStatsUpdate(normalized);
      }
      
    } catch (error) {
      console.error('Failed to load purchases:', error);
      setError('Failed to load purchases. Please try again.');
      // Fallback to empty array instead of demo data for production
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchase = () => {
    setSelectedPurchase(null);
    setOpenForm(true);
  };

  const handleEditPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setOpenForm(true);
  };

  const handleViewDetails = (purchase) => {
    setSelectedPurchase(purchase);
    // You can implement a view details dialog here
    console.log('View purchase details:', purchase);
  };

  const handleFormClose = () => {
    setOpenForm(false);
    setSelectedPurchase(null);
  };

  const handleFormSubmit = (purchase) => {
    console.log('Purchase submitted successfully:', purchase);
    setOpenForm(false);
    setSelectedPurchase(null);
    loadPurchases(); // Refresh the list
    if (onStatsUpdate) {
      onStatsUpdate(); // Update statistics
    }
  };

  const handleRefresh = () => {
    loadPurchases();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'primary';
      case 'paid': return 'success';
      case 'cancelled': return 'error';
      case 'draft': return 'default';
      default: return 'default';
    }
  };

  

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getItemsSummary = (items) => {
    if (!items || !Array.isArray(items)) return '0 items';
    const totalItems = items.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0);
    return `${items.length} product${items.length !== 1 ? 's' : ''}, ${totalItems} unit${totalItems !== 1 ? 's' : ''}`;
  };

  const columns = [
    { 
      field: 'supplier', 
      headerName: 'Supplier', 
      width: 200,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.row.supplier?.name || 'N/A'}
        </Typography>
      )
    },
    { 
      field: 'items', 
      headerName: 'Items', 
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {getItemsSummary(params.row.items)}
        </Typography>
      )
    },
    { 
      field: 'grandTotal', 
      headerName: 'Total Amount', 
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold" color="primary">
          {formatCurrency(params.value)}
        </Typography>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 130,
      renderCell: (params) => (
        <Chip 
          label={(params.value || 'draft').toUpperCase()} 
          color={getStatusColor(params.value)}
          size="small"
          variant="filled"
        />
      )
    },
    { 
      field: 'paymentMethod', 
      headerName: 'Payment', 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={(params.value || 'cash').toUpperCase()} 
          size="small"
          variant="outlined"
          color="primary"
        />
      )
    },
    { 
      field: 'createdAt', 
      headerName: 'Date', 
      width: 120,
      valueFormatter: (params) => formatDate(params.value)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => handleEditPurchase(params.row)}
            color="primary"
            title="Edit Purchase"
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleViewDetails(params.row)}
            color="info"
            title="View Details"
          >
            <Visibility fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Purchase Products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and track your product purchases
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreatePurchase}
            size="large"
          >
            New Purchase
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by supplier or product..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="submitted">Submitted</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="From Date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="To Date"
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={loadPurchases}
                  startIcon={<FilterList />}
                  fullWidth
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Apply Filters'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFilters({ status: '', search: '', fromDate: '', toDate: '' });
                    loadPurchases();
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Purchases Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={purchases}
            columns={columns}
            autoHeight
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            getRowId={(row) => row._id || row.id}
            disableSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #f0f0f0'
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e2e8f0'
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#f8fafc'
              }
            }}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Purchase Form Dialog */}
      <Dialog
        open={openForm}
        onClose={handleFormClose}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxWidth: '1200px',
            width: '95%',
            height: '95%'
          }
        }}
      >
        <PurchaseForm
          initialData={selectedPurchase}
          onSave={handleFormSubmit}
          onCancel={handleFormClose}
        />
      </Dialog>
    </Box>
  );
};

export default PurchaseProducts;
