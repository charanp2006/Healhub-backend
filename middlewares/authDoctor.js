import jwt from 'jsonwebtoken';

// Doctor authentication middleware
const authDoctor = async (req, res, next) => {
    try {

        const {dtoken} = req.headers
        if (!dtoken) {
            return res.json({ success: false, message: 'Not Authorised Login again' });
        }
        const token_decode = jwt.verify(dtoken, process.env.JWT_SECRET);

        // 👇 ensure req.body exists
        if (!req.body) {
            req.body = {};
        }
        
        req.body.docId = token_decode.id;

        // if (token_decode != process.env.ADMIN_EMAIL + process.env.ADMIN_PW) {
        //     return res.json({ success: false, message: 'Not Authorised Login again' });
        // }
        
        next();
        
    } catch (error) {
        console.log('Error in user Authentication:', error);
        res.json({ success: false, message: error.message}); 
    }
}

export default authDoctor;