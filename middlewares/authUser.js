import jwt from 'jsonwebtoken';

// User authentication middleware
const authUser = async (req, res, next) => {
    try {

        const {token} = req.headers
        if (!token) {
            return res.json({ success: false, message: 'Not Authorised Login again' });
        }
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);

        // 👇 ensure req.body exists
        if (!req.body) {
            req.body = {};
        }
        
        req.body.userId = token_decode.id;

        // if (token_decode != process.env.ADMIN_EMAIL + process.env.ADMIN_PW) {
        //     return res.json({ success: false, message: 'Not Authorised Login again' });
        // }
        
        next();
        
    } catch (error) {
        console.log('Error in user Authentication:', error);
        res.json({ success: false, message: error.message}); 
    }
}

export default authUser;