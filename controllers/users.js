const bcrypt = require("bcryptjs");
const { User } = require("../models/index.js");

const config = require("../config/config");
const jwt = require("jsonwebtoken");
const { cloudinary } = require("../helpers/index.js");
const { userFeatures } = require("../helpers/userFeatures.js");

module.exports.signUp = async (req, res, next) => {
  try {
    if (await User.findOne({ username: req.body.username }))
      return res.json({ success: false, msg: "username exists" });
    if (!req.body.password || req.body.password.length < 8)
      return res.json({
        success: false,
        msg: "password should be 8 digits or more"
      });
    if (await User.findOne({ email: req.body.email }))
      return res.json({ success: false, msg: "email exists" });

    let newUser = new User({
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      username: req.body.username,
      password: await bcrypt.hash(req.body.password, 10)
    });
    await newUser.save();
    next();
  } catch (err) {
    res.json({ success: false, msg: `something went wrong : ${err}` });
  }
};
module.exports.logIn = async (req, res, next) => {
  try {
    const username = req.body.username;
    const password = req.body.password;
    var user = await User.findOne({ username });
    if (!user) return res.json({ success: false, msg: "User not found" });
    var isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token =
        "jwt " + jwt.sign(user.toJSON(), config.secret, { expiresIn: 604800 });
      user.password = undefined;
      res.json({
        success: true,
        token,
        user
      });
    } else {
      res.json({ success: false, msg: "Password is incorrect" });
    }
  } catch (err) {
    res.json({ success: false, msg: `something went wrong : ${err}` });
  }
};
module.exports.verifyToken = async (req, res) => {
  try {
    var authorization = req.headers.authorization.replace(/^jwt\s/, "");
    var user = jwt.verify(authorization, config.secret);
    res.send({ success: true, user, err: null });
  } catch (err) {
    res.send({ success: false, user: null, err });
  }
  // var token = req.headers.authorization? jwt.verify(req.headers.authorization, config.secret) : false
};

module.exports.getUser = async (req, res) => {
  try {
    var user = await User.findOne({ username: req.params.username }).lean();
    console.log(user);
    await userFeatures([user], req.community, req.user);

    res.json({ success: true, result: user });
  } catch (err) {
    res.json({ success: false, err, msg: "failed to fetch user" });
  }
};

module.exports.updateUser = async (req, res) => {
  try {
    if(!(await bcrypt.compare(req.body.oldpassword, req.user.password))) return res.json({success : false, msg : "Password is incorrect"})

    if(req.body.username && req.body.username != req.user.username){
      if(await User.findOne({username : req.body.username})) return res.json({success : false, msg : "Username exists"})
    }
    if(req.body.password && req.body.password != req.body.confirmation)  return res.json({success : false, msg : "new password confimation is wrong"})
    
    if (req.file) {
      let file;
      if (req.file.mimetype.match(/jpg|jpeg|png/i)) {
        file = await cloudinary.v2.uploader.upload(req.file.path);
        req.body.file = file.url;
      }
    }else req.body.file = req.user.file
  var data = {
      bio: true,
      firstname: true,
      lastname: true ,
      username : true,
      password: true,
      email: true ,
      file: true  ,
      facebook:true,
      twitter:true,
      instagram:true,
      linkedIn:true
  }
  var entries = Object.entries(req.body)
  for (let i = 0; i < entries.length; i++) {
   let one = entries[i]
   if(one[0] == "password"){
     if(one[1]) data[one[0]] = await bcrypt.hash(one[1], 10)
     else delete data[one[0]]
   }else {
     if(one[1] && data[one[0]] && one[1] != req.user[one[0]]) data[one[0]] = one[1]
     else delete data[one[0]]
   }
    
  }
    var result = await User.findByIdAndUpdate(req.user._id, {
      $set: data
    });
    
    res.json({ success: true, msg: "settings updated", result });
  } catch (err) {
    res.json({ success: false, err, msg: "failed to update user settings" });
  }
};

module.exports.search = (req, res) => {
  var regex = { $regex: req.query.keyword, $options: "i" };

  User.aggregate([
    {
      $project: {
        name: { $concat: ["$firstname", " ", "$lastname"] },
        username: "$username",
        image: "$file"
      }
    },
    { $match: { $or: [{ name: regex }, { username: regex }] } }
  ])
    .then(results => {
      res.json({ success: true, results });
    })
    .catch(err => {
      res.json({ success: false, err });
    });
};
