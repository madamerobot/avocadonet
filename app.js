//---------CONFIG AND LIBRARIES-----------------

//Config with Postgres credentials
const config = require('./config');

//Requiring Sequelize library & initiating db connection
const Sequelize = require('sequelize');
const username = config.config.username;
const password = config.config.password;
const sequelize= new Sequelize('postgres://' + username+ ':' + password + '@localhost/avocadonet');

//Requiring express library
const express = require('express');
//Initialising express library
const app = express();
//Requiring express-session
var session = require('express-session')
//Initialising session
app.use(session({
	secret: 'Heckmeck am Bratwurmeck',
	resave: true,
	saveUninitialized: false
}));

//Requiring file system library
const fs = require('fs');

//Requiring body parser library
//This adds a body property to the request parameter of every app.get and app.post
const bodyParser = require('body-parser');
//Initialising body-parser li;brary
app.use(bodyParser.urlencoded({
	extended: false
}))
app.use(bodyParser.json())

//Setting PUG view engine
app.set('views', './views');
app.set('view engine', 'pug');

app.use(express.static('public'));

//Requiring postgres library
const pg = require('pg');

//Requiring bcrypt
var bcrypt = require('bcrypt-nodejs');

//------------DEFINING DATABASE MODELS
var User = sequelize.define('user', {
	name: Sequelize.STRING,
	password: Sequelize.STRING
});

var Post = sequelize.define('post', {
	post: Sequelize.STRING,
});

var Comment = sequelize.define('comment', {
	comment: Sequelize.STRING
});

//Defining dependencies
//A user can write many posts
User.hasMany(Post);
//A post only belongs to one user
Post.belongsTo(User);

//A user can write many comments
User.hasMany(Comment);
//A comment only belongs to one user
Comment.belongsTo(User);

//Many comments belong to a post
Post.hasMany(Comment);
//A comment only belongs to one post
Comment.belongsTo(Post);

//----------------ROUTES----------------

//ROUTE 01: HOME------------------------
app.get('/', function(req, res){

	var user = req.session.user;
	var message = req.query.message;

	res.render("home", {user: user, message: message});

});

//CHECKING IF FORM INPUT USERDATA MATCHES DATABASE ENTRY. IF YES, ASSIGN SESSION TO USER.
app.post('/', function (req, res) {

	var password = req.body.password;
	var username = req.body.username;
	console.log('This is what I get: '+username+" "+password);

	if(username.length === 0) {
		res.redirect('/?message=' + encodeURIComponent("Please fill out your email address."));
		return;
	}

	if(password.length === 0) {
		res.redirect('/?message=' + encodeURIComponent("Please fill out your password."));
		return;
	}

	User.findOne({
		where: {
			name: username
		}
	}).then(function(user){
		var hash = user.password;
		console.log('Hash: '+hash);
		bcrypt.compare(password, hash, function(err, result){
			if(err){
				console.log(err);
				res.redirect('/?message=' + encodeURIComponent('Invalid email or password.'));
			} else {
				req.session.user = user;
				res.redirect('/myprofile');
			}
		});
	});
});

//ROUTE 02: CREATING NEW USER IN SIGNUP-------------
app.get('/signup', function(req, res){
	res.render("signup");
})

app.post('/signup', function(req, res){

	var inputname = req.body.username;
	var inputpassword = req.body.password;

	User.findOne({
			where: {
				name: inputname
			}
	})
	.then(function(user){
			if (user) {
				res.redirect('/?message=' + encodeURIComponent('Username already exists. Please choose a different one.'));
			} else {
				bcrypt.hash(inputpassword, null, null, function(err, hash){
					if (err){
						console.log(err);
					} else {
							User.create({
							name: inputname,
							password: hash
							}).then( () => {
								res.redirect('/?message=' + encodeURIComponent("Your user got successfully created. Log in below."));
							});
					}
				}); /* closing bcrypt */
			}
	})
})


//ROUTE 03: WRITING A NEW POST---------------------
app.get('/addpost', function (req, res) {

	const user = req.session.user;

	if (user === undefined) {
		res.redirect('/?message=' + encodeURIComponent("Please log in to add a new post."));
	} else {
		res.render("addpost");
	}
});

app.post('/addpost', function(req, res) {
	
	var user = req.session.user.name;
	var inputmessage = req.body.posting;
	console.log('I receive this input as new posting: '+inputmessage);
	console.log('I receive this input as user info: '+user);

	User.findOne({
		where: {
			name: user
		}
	})
	.then(function(user){
		return user.createPost({
			post: inputmessage
		})
	})
	.then( post => {
		res.redirect(`/posts/${post.id}`);
	})
});

//ROUTE 04: DISPLAYING SINGLE POST PAGE INCLUDING USER COMMENTS

app.get('/posts/:postId', function(req, res){
	
	const postId = req.params.postId;
	// console.log('This is what I receive as postId in the postId get request: '+postId);
	
	var postingcontent = "";
	var comments = [];
	// var commentusername = "";
	var username = "";
	var date;
	var commentinfo = [];

	Post.findOne({
		where: {
			id: postId
		},
		include: [{
			model: Comment
		},
		{
			model: User
		}]
	})
	.then(function(post){
		
		postingcontent = post.post;
		comments = post.comments.reverse();
		username = post.user.name;
		date = post.createdAt;

		var commentsinfo = [];

		var commentusername;
		var commentcreatedAt;

		for (var i=0; i < comments.length; i++){

			commentcreatedAt = comments[i].createdAt;
			// commentsinfo.push(commentcreatedAt);

			User.findOne({
				where: {
					id: comments[i].userId
				}
			}).then(function(user){				
				commentusername = user.name;
				console.log('name: '+commentusername);
				// commentinfo.push(commentusername);
			})
		}
	})
	.then(function(){
		console.log('----->'+commentinfo);
		res.render("post", {postingcontent: postingcontent, comments: comments, 
			postId: postId, username: username, date: date});
	});
});

//ROUTE 05: REDIRECTING COMMENT CREATION TO SEPERATE ROUTE, 
//SO THAT DATA HANDLING IS MORE TRANSPARENT

app.post('/comment/:postId', function(req, res) {

	const postId = req.params.postId;
	console.log('This is what I receive as postId in the comment post request: '+postId);
	const user = req.session.user.name;
	console.log('I see this as session user in the comment post request: '+user);
	const inputcomment = req.body.comment;
	console.log('I receive this input as new comment in the comment post request: '+inputcomment);

	if (user === undefined) {
		res.redirect('/?message=' + encodeURIComponent("Please log in to read the comments."));
	} else {
		User.findOne({
			where: {
				name: user
			}
		})
		.then(function(user){
			console.log('Seq finds this user: '+user);
			return user.createComment({
				comment: inputcomment,
				postId: postId
			})
		}) 
		res.redirect(`/posts/${postId}`)
	}
});
	
//ROUTE 06: DISPLAYING ALL POSTINGS OF A SINGLE USER------------

//MAKES IT POSSIBLE TO ACCESS ALL USER PROFILES BY USERNAME IN URL
app.get('/profile/:username', function (req, res) {

	var username = req.params.username;
	var user = req.session.user;

	if (user === undefined) {
		res.redirect('/?message=' + encodeURIComponent("Please log in to view other's profiles."));
	} else {
		User.findOne({
			include: [Post],
			where: {
				name: username
			}
		}).then(function(user){
			res.render("profile", {posts: user.posts, username: user.name});
		});
	}
});

//RENDERS PERSONAL PROFILE FOR USER WHO IS LOGGED IN
app.get('/myprofile', function (req, res){

	var user = req.session.user;

	if ( user === undefined) {
		res.redirect('/?message=' + encodeURIComponent("Please log in to view your profile."));
	} else {
		User.findOne({
			include: [Post],
			where: {
				name: user.name
			}
		}).then(function(user){
			var mostrecent = user.posts.reverse();

			console.log('----->'+user.name);

			res.render("profile", {posts: mostrecent, username: user.name});
		})
	}
})

//ROUTE 07: DISPLAYING ALL POSTINGS OF ALL USERS----------------
app.get('/allpostings', function (req, res) {

	var user = req.session.user;
	if (user === undefined) {
		res.redirect('/?message=' + encodeURIComponent("Please log in to view all postings."));
	} else {
		Post.findAll({
			include: [User]
		}).then(function(allpostings){	
			// console.log(JSON.stringify(allpostings, null, 2));
			var mostrecent = allpostings.reverse();
			res.render("allpostings", {allpostings: mostrecent});
		});
	}
});

//ROUTE 08: SIGN OUT--------------------------------------------
app.get('/logout', function (req, res) {

	req.session.destroy(function(error) {
		if(error) {
			throw error;
		}
		res.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
	})
});

//------------DEFINING PORT 8080 FOR SERVER----------------------
var server = app.listen(7000, () => {
	sequelize.sync({force: false})
	console.log('Yo, this http://localhost is running:' + server.address().port);
});