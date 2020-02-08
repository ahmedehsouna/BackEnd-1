const bcrypt = require("bcryptjs");
const { User } = require("../models/index.js");

const config = require("../config/config");
const jwt = require("jsonwebtoken");
const { cloudinary } = require("../helpers/index.js");
const { userFeatures } = require("../helpers/userFeatures.js");

module.exports.signUp = async (req, res, next) => {
  console.log(req.body);
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
    res.json({ success: true, msg: "you've signed up successfully" });
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
    await userFeatures([user], req.community, req.user);
    res.json({ success: true, result: user });
  } catch (err) {
    res.json({ success: false, err, msg: "failed to fetch user" });
  }
};

module.exports.updateUser = async (req, res) => {
  try {
    if (req.file) {
      let file;
      if (req.file.mimetype.match(/jpg|jpeg|png/i)) {
        file = await cloudinary.v2.uploader.upload(req.file.path);
      }
      console.log(file);
      req.body.file = file.url;
    }

    var result = await User.findByIdAndUpdate(req.user._id, {
      $set: {
        bio: req.body.bio,
        firstname: req.body.firstname,
        lastname: req.body.firstname,
        password: await bcrypt.hash(req.body.password, 10),
        email: req.body.email,
        file: req.body.file
      }
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
        username: "$username"
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
