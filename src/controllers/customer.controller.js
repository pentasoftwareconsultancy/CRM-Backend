import Customer from '../models/Customer.model.js';
import Lead from '../models/Lead.model.js';
import Deal from '../models/Deal.model.js';

/**
 * Creates a Customer entry based on a 'WON' Deal and its Lead.
 * This is called internally by the deal controller when a deal is closed as WON.
 * @param {Object} dealId - The ID of the closed deal
 * @returns {Promise<Customer>}
 */
export const createCustomerFromDeal = async (dealId) => {
    const deal = await Deal.findById(dealId).populate('lead');
    console.log(deal);

    if (!deal || deal.stage !== 'WON' || !deal.lead) {
        throw new Error('Deal is not won or missing lead data.');
    }
    
    const lead = deal.lead;

    // FR-27: Copy relevant fields from Lead to Customer
    const customerData = {
        lead: lead._id,
        owner: deal.owner,
        name: lead.company || lead.name, 
        primaryContact: lead.name,
        email: lead.email,
        phone: lead.phone,
        // Billing info and other details are assumed empty or manually added later
        convertedDate: deal.closedAt 
    };
    
    const customer = await Customer.create(customerData);
    return customer;
};


// @desc    Get list of customers (7.1 GET /customers)
// @access  Authenticated
export const getCustomers = async (req, res) => {
    const { search, owner, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filters = {}; 

    if (req.user.role === 'sales') {
        filters.owner = req.user._id;
    } else if (owner) {
        filters.owner = owner;
    }

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filters.$or = [
            { name: searchRegex },
            { primaryContact: searchRegex },
            { email: searchRegex }
        ];
    }
    
    try {
        const totalCustomers = await Customer.countDocuments(filters); 
        const customers = await Customer.find(filters)
            .sort({ convertedDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('owner', 'name');

        const customerData = customers.map(c => ({ ...c.toObject(), id: c._id }));

        res.json({
            data: customerData,
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCustomers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
};

// @desc    Get customer detail (7.3 GET /customers/:id)
// @route   GET /api/customers/:id
// @access  Authenticated
export const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)
            .populate('owner', 'name email');
        
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        // Authorization check
        // Check if customer.owner is an object (populated) or just an ID
        const customerOwnerId = customer.owner._id ? customer.owner._id.toString() : customer.owner.toString(); 

        if (req.user.role === 'sales' && customerOwnerId !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this customer' });
        }
        
        res.json(customer);
    } catch (error) {
           console.error(error);
        res.status(500).json({ message: 'Error fetching customer' });
    }
};

// @desc    Update customer info (7.4 PUT /customers/:id)
// @route   PUT /api/customers/:id
// @access  Authenticated (Owner, Manager, Admin)
export const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        // Authorization check
        if (req.user.role === 'sales' && customer.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({ 
            message: 'Customer updated successfully',
            customer: updatedCustomer
        });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Manual customer creation (7.2 POST /customers)
// @route   POST /api/customers
// @access  Admin, Manager
export const manualCreateCustomer = async (req, res) => {
    try {
        const customer = await Customer.create({
            ...req.body,
            owner: req.body.owner || req.user._id // Allow assignment if manager/admin
        });
        res.status(201).json({ message: 'Customer created manually', customer });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};