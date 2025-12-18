import User from '../models/User.model.js';

// Helper function for filtering
const buildUserQuery = (query) => {
    const filters = { status: 'active' }; // Default only active users
    if (query.role) {
        filters.role = { $in: query.role.split('|') };
    }
    if (query.status) {
        filters.status = { $in: query.status.split('|') };
    }
    
    // Basic search by name or email
    if (query.search) {
        const search = new RegExp(query.search, 'i');
        filters.$or = [{ name: search }, { email: search }];
        // If status was active, we need to ensure the status is still respected
        delete filters.status; // Remove status filter for $or query to simplify
        filters.$and = [{ $or: [{ name: search }, { email: search }] }, { status: 'active' }];
    }
    
    return filters;
};

// @desc    Get list of users (2.1 GET /users)
// @route   GET /api/users
// @access  Admin
export const getUsers = async (req, res) => {
    try {
        const filters = buildUserQuery(req.query);
        
        const users = await User.find(filters).select('-password');
        res.json(users);
    } catch (error) {
           console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// @desc    Create a new user (2.2 POST /users)
// @route   POST /api/users
// @access  Admin
export const createUser = async (req, res) => {
    const { name, email, password, role, designation, phone } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
    }

    try {
        const user = await User.create({
            name, email, password, role, designation, phone
        });

        // Response should exclude the password field (handled by default select: false)
        res.status(201).json({
            message: 'User created successfully',
            user: user
        });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get details of a specific user (2.3 GET /users/:id)
// @route   GET /api/users/:id
// @access  Admin
export const getUserById = async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update user details (2.4 PUT /users/:id)
// @route   PUT /api/users/:id
// @access  Admin
export const updateUser = async (req, res) => {
    const userId = req.params.id;
    const updates = req.body;

    try {
        // Find user but prevent direct modification of sensitive fields like email
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key !== 'password' && key !== 'email') {
                user[key] = updates[key];
            }
        });

        const updatedUser = await user.save();
        res.json({ 
            message: 'User updated successfully',
            user: updatedUser 
        });

    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft-delete / deactivate user (2.5 DELETE /users/:id)
// @route   DELETE /api/users/:id
// @access  Admin
export const deactivateUser = async (req, res) => {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
        userId, 
        { status: 'inactive' }, 
        { new: true }
    );

    if (user) {
        res.json({ message: 'User deactivated successfully' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};