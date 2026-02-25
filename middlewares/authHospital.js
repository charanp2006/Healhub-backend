import jwt from 'jsonwebtoken';

// Hospital authentication middleware
const authHospital = async (req, res, next) => {
    try {
        const { htoken } = req.headers;
        if (!htoken) {
            return res.json({ success: false, message: 'Not Authorised Login again' });
        }
        const token_decode = jwt.verify(htoken, process.env.JWT_SECRET);

        if (!req.body) {
            req.body = {};
        }

        req.body.hospitalId = token_decode.id;
        next();
    } catch (error) {
        console.log('Error in hospital Authentication:', error);
        res.json({ success: false, message: error.message });
    }
}

export default authHospital;
