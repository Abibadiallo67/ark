const User = require('../models/User');

class UserController {
  // Obtenir le profil utilisateur
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('-password -twoFactorSecret -creditHistory');
      
      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }

  // Mettre à jour le profil
  static async updateProfile(req, res) {
    try {
      const updates = req.body;
      const allowedUpdates = [
        'firstName', 'lastName', 'country', 'city', 'contacts'
      ];

      // Filtrer les mises à jour autorisées
      const filteredUpdates = {};
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        filteredUpdates,
        { new: true, runValidators: true }
      ).select('-password -twoFactorSecret');

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  // Changer le mot de passe
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');

      // Vérifier l'ancien mot de passe
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Mettre à jour le mot de passe
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  // Obtenir l'historique des crédits
  static async getCreditHistory(req, res) {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const skip = (page - 1) * limit;

      const user = await User.findById(req.user._id)
        .select('creditHistory credit')
        .slice('creditHistory', [skip, parseInt(limit)]);

      let history = user.creditHistory;

      // Filtrer par type si spécifié
      if (type) {
        history = history.filter(item => item.type === type);
      }

      res.json({
        success: true,
        data: {
          currentCredit: user.credit,
          history,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: history.length
          }
        }
      });
    } catch (error) {
      console.error('Get credit history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get credit history'
      });
    }
  }

  // Transférer des crédits
  static async transferCredit(req, res) {
    try {
      const { toUserId, amount, description } = req.body;

      if (!toUserId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Recipient and amount are required'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0'
        });
      }

      const user = await User.findById(req.user._id);
      const result = await user.transferCredit(toUserId, amount, description);

      res.json({
        success: true,
        message: 'Credit transfer successful',
        data: result
      });
    } catch (error) {
      console.error('Transfer credit error:', error);
      
      if (error.message === 'Insufficient credit') {
        return res.status(400).json({
          success: false,
          error: 'Insufficient credit balance'
        });
      }

      if (error.message === 'Recipient not found') {
        return res.status(404).json({
          success: false,
          error: 'Recipient not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Credit transfer failed'
      });
    }
  }

  // Obtenir les statistiques d'affiliation
  static async getAffiliateStats(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('referrals.userId', 'username email createdAt')
        .populate('referredBy', 'username affiliateCode');

      const totalCommission = user.referrals.reduce(
        (sum, ref) => sum + (ref.commissionEarned || 0), 0
      );

      const stats = {
        affiliateCode: user.affiliateCode,
        commissionRate: user.commissionRate,
        totalReferrals: user.referrals.length,
        totalCommissionEarned: totalCommission,
        referredBy: user.referredBy,
        referrals: user.referrals
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get affiliate stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get affiliate statistics'
      });
    }
  }
}

module.exports = UserController;
