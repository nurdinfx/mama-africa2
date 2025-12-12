import api from './auth';

export const settingsAPI = {
  getBranchSettings: (branchId) => 
    api.get(`/settings/branch/${branchId}`),
  
  updateBranchSettings: (branchId, settings) => 
    api.put(`/settings/branch/${branchId}`, settings),
  
  uploadLogo: (branchId, logoFile) => {
    const formData = new FormData();
    formData.append('logo', logoFile);
    return api.post(`/settings/branch/${branchId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};