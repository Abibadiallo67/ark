const express = require('express');
const router = express.Router();
const AuthMiddleware = require('../middleware/auth');
const User = require('../models/User');

// Middleware admin seulement
router.use(AuthMiddleware.verifyToken);
router.use(AuthMiddleware.checkRole(['admin']));

// Gestion des utilisateurs
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, userType, country } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }
    if (userType) filter.userType = userType;
    if (country) filter.country = country;

    const users = await User.find(filter)
      .select('-password -twoFactorSecret')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

// Gérer un utilisateur spécifique
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Statistiques système
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalCredit,
      usersByType,
      usersByCountry
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$credit' } } }]),
      User.aggregate([{ $group: { _id: '$userType', count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$country', count: { $sum: 1 } } }])
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalCredit: totalCredit[0]?.total || 0,
        usersByType,
        usersByCountry: usersByCountry.sort((a, b) => b.count - a.count).slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

module.exports = router;
