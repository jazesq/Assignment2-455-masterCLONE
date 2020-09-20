'use strict'

// Import express
const  express = require('express');

// Import client sessions
const sessions = require('client-sessions');

// The body parser
const bodyParser = require("body-parser");

// sEcuRiTy
const xssFilters = require('xss-filters');
const csp = require('helmet-csp')

// The mysql library
const mysql = require('mysql');

// Instantiate an express app
const app = express();


// Connect to the database
const  mysqlConn = mysql.createConnection({
	host: "localhost",
	user: "bankuser",
	password: "bankpass",
	multipleStatements: true
});

/*
Content Security Policy set to only receive files, scripts,
any (potential) images to only come from the server.
*/
app.use(csp({
	directives: {
		defaultSrc: ["'self'", 'localhost:3000'],
		scriptSrc: ["'self'", 'localhost:3000'],
		imgSrc: ['data:']
	}
}));


// Needed to parse the request body
// Note that in version 4 of express, express.bodyParser() was
// deprecated in favor of a separate 'body-parser' module.
app.use(bodyParser.urlencoded({ extended: true }));

// The session settings middleware
app.use(sessions({
  cookieName: 'session',
  secret: 'random_string_goes_here',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
}));


// Query the DB for the user
mysqlConn.query('USE Bank; SELECT * FROM Bank.BankUsers;', function(err, qResult){

	if(err) throw err;

	//console.log(qResult[1]);

	// Does the password match?
	let match = false;

	// Go through the results of the second query
	qResult[1].forEach(function(account){

		console.log("Account is: " + JSON.stringify(account));
	});

});


/*
This will check if the user's session is still valid.
If valid, the user will be redirected to his dashboard.
Else, the user will be redirected to the login page.
*/
app.get('/', (req, res) => {
	// Is this user logged in?
	if(Object.keys(req.session).length !== 0)
	{
		// Yes!
		res.redirect("/login");
	}
	else
	{
		// No!
		res.sendFile(__dirname + "/Views/login.html");
	}
});




//------------------------Depositing-----------------------
/*
This function will check if the user has an account to deposit
money into. If not, then the user will be told that there are
no accounts and can either create a checking/savings account
or return to the homepage. If yes, the user will be redirected
to the deposit page.
*/
app.get('/toDeposit', (req, res) => {
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let username = req.session.userAccount.username;
		let query = "USE Bank; Select * FROM UserAccount WHERE `a_username`=?";
		mysqlConn.query(query, [username], function(err, qResult){
			if(err) throw err;
			if(qResult[1].length > 0){
				res.sendFile(__dirname + "/Views/deposit.html");
			}else{
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>No Accounts To Deposit!</h3>";
				htmlString += "<a href='/DirectCreateBankAccount'>Create an account</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";	
			
				res.send(htmlString);
			}
		});
		
	}
});

/*
This function will allow a user to deposit money into an account.
The account name is retrieved from the deposit form.
*/
app.post('/deposit', (req, res) => {
	let username = req.session.userAccount.username;
	let accountName = xssFilters.inHTMLData(req.body.accountName);
	let depositAmount = xssFilters.inHTMLData(req.body.depAmount);
	let oldAmount = 0;
	let newAmount = 0;
	
	if(depositAmount < 0.0 || isNaN(depositAmount) || !isFinite(depositAmount))
	{
		let htmlString = "<!DOCTYPE html><html><body>";
		htmlString += "<h3>ERROR! Invalid amount depositied.</h3>";
		htmlString += "<a href='/login'>Home</a></body></html>";

		res.send(htmlString);
	}else{
	
		let query = "USE Bank; SELECT a_amount FROM UserAccount WHERE `a_name`=? AND `a_username`=?";
		let values = [accountName, username];

		// Query the DB for the user
		mysqlConn.query(query, values,function(err, qResult){
		
			if(err) throw err;
		
			if(qResult[1].length === 0){
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>Account Not Found!</h3>";
				htmlString += "<a href='/toDeposit'>Deposit</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";

				res.send(htmlString);
			}else{
				oldAmount = qResult[1][0]['a_amount'];

				newAmount = Number(oldAmount) + Number(depositAmount);
		
				// Construct the query
				let query2 = "USE Bank; UPDATE UserAccount SET a_amount= ? WHERE a_name= ? AND a_username= ? ";
				let values2 = [newAmount.toFixed(2), accountName, username];
	
				// Query the DB for the user
				mysqlConn.query(query2, values2 ,function(err, qResult){
					if(err) throw err;
		
					let htmlString = "<!DOCTYPE html><html><body>";
					htmlString += "<h3>Deposit Successful</h1><br>";
					htmlString += "You have deposited: $" + Number(depositAmount).toFixed(2) + "<br>";
					htmlString += "Your new account balance is: $" + newAmount.toFixed(2) + "<br>";
					htmlString += "<a href='/toDeposit'>Make Another Deposit</a><br>";
					htmlString += "<a href='/login'>Home</a><br>";
					htmlString += "</body></html>";
			
					res.send(htmlString);
				});
			}
	});

		}
});



app.get('/toWithdraw', (req, res) => {
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let username = req.session.userAccount.username;
		let query = "USE Bank; Select * FROM UserAccount WHERE `a_username`=?";
		mysqlConn.query(query, [username], function(err, qResult){
			if(err) throw err;
			if(qResult[1].length > 0){
				res.sendFile(__dirname + "/Views/withdraw.html");
			}else{
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>No Accounts To Withdraw From!</h3>";
				htmlString += "<a href='/DirectCreateBankAccount'>Create an account</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";	
			
				res.send(htmlString);
			}
		});
		
	}
});

app.post('/withdraw', (req, res) => {
	let username = req.session.userAccount.username;
	let accountName = xssFilters.inHTMLData(req.body.accountName);
	let withdrawAmount = xssFilters.inHTMLData(req.body.withdrawamount);
	let oldAmount = 0;
	let newAmount = 0;
	
	if(withdrawAmount < 0.0 || isNaN(withdrawAmount) || !isFinite(withdrawAmount))
	{
		let htmlString = "<!DOCTYPE html><html><body>";
		htmlString += "<h3>ERROR! Invalid amount withdrawn.</h3>";
		htmlString += "You requested an invalid amount to withdraw.<br>";
		htmlString += "<a href='/toWithdraw'>Withdraw</a><br>";
		htmlString += "<a href='/login'>Home</a></body></html>";

		res.send(htmlString);
	}else{
	
		let query = "USE Bank; SELECT a_amount FROM UserAccount WHERE `a_name`=? AND `a_username`=?";
		let values = [accountName, username];

		// Query the DB for the user
		mysqlConn.query(query, values,function(err, qResult){
		
			if(err) throw err;
			oldAmount = qResult[1][0]['a_amount'];	
			if(qResult[1].length === 0){
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>Account Not Found!</h3>";
				htmlString += "<a href='/toWithdraw'>Withdraw</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";
	
				res.send(htmlString);
			}else if(oldAmount < withdrawAmount){
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>You Broke!</h3>";
				htmlString += "You requested $" + withdrawAmount + ", but only have $" + oldAmount + ".<br>";
				htmlString += "<a href='/toWithdraw'>Withdraw</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";
	
				res.send(htmlString);
			}else{

				newAmount = Number(oldAmount) - Number(withdrawAmount);
		
				// Construct the query
				let query2 = "USE Bank; UPDATE UserAccount SET a_amount= ? WHERE a_name= ? AND a_username= ? ";
				let values2 = [newAmount.toFixed(2), accountName, username];
		
				// Query the DB for the user
				mysqlConn.query(query2, values2 ,function(err, qResult){
					if(err) throw err;
		
					let htmlString = "<!DOCTYPE html><html><body>";
					htmlString += "<h3>Withdraw Successful!</h1><br>";
					htmlString += "You withdrew: $" + Number(withdrawAmount).toFixed(2) + "<br>";
					htmlString += "Your new account balance is: $" + newAmount.toFixed(2) + "<br>";
					htmlString += "<a href='/toWithdraw'>Make Another Withdrawal</a><br>";
					htmlString += "<a href='/login'>Home</a><br>";
					htmlString += "</body></html>";
	
					res.send(htmlString);
				});
			}
		});
	}

});

//--------------------End of Withdraw-----------------------

/*
This function checks if the user has accounts to view.
If yes, the user will be redirected to the view accounts page.
If no, the user will be told that he has no accounts to view
and will be given link options to either return home or create
a checking/savings account.
*/
app.get('/toViewAccounts', function(req, res){
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let username = req.session.userAccount.username;
		let query = "USE Bank; Select * FROM UserAccount WHERE `a_username`=?";
		mysqlConn.query(query, [username], function(err, qResult){
			if(err) throw err;
			if(qResult[1].length > 0){
				res.redirect('/viewAccounts');
			}else{
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>No Accounts To View!</h3>";
				htmlString += "<a href='/DirectCreateBankAccount'>Create an account</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";	
			
				res.send(htmlString);
			}
		});
		
	}
});


/*
This page will let the user manage his accounts.
*/
app.get('/viewAccounts', function(req, res){
	// Check that the user's session is valid.

	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{

		console.log("Authenticated session for user:", req.session.userAccount.username);

		let username = req.session.userAccount.username;
		let password = req.session.userAccount.password;
		let firstname = "";
		let lastname = "";
		let htmlString = "<!DOCTYPE html><html><head><title>Dashboard</title></head>";
		let accounts = [];

		let query = "USE Bank; Select * FROM UserAccount WHERE a_username='" + username + "'";
		mysqlConn.query(query, function(err, qResult){
			if(err) throw err;

			qResult[1].forEach(function(account){
				accounts.push(JSON.parse(JSON.stringify(account)));
			});


			htmlString += "<body><h1>Pacific Banking</h1>";
			htmlString += "<form action='/changeAccount' method='post'>";
			htmlString += "<label for='acc'>Change Accounts:</label>";
			htmlString += "<select id='acc' name='acc'>";

			for(let acc in accounts)
			{
				htmlString += "<option value='" + accounts[acc]['a_name'] + "'>" + accounts[acc]['a_name'] + "</option>";
			}
			htmlString += "</select>";
			htmlString += "<input type='submit' value='Submit'/></form>";
			htmlString += "<h3>Account: " + accounts[0]['a_name'] + "<br>";
			htmlString += "Type: " + accounts[0]['a_type'] + "<br>";
			htmlString += "Amount: $" + accounts[0]['a_amount'].toFixed(2) + "</h3><br>";

			htmlString += "<form action='/deleteAccount' method='post'>";
			htmlString += "<input type='hidden' name='acc' value='" + accounts[0]['a_name'] + "'>"; 
			htmlString += "<input type='submit' value='Delete Account'></form>";

			htmlString += "<a href='/login'>Home</a><br>";
			htmlString += "<a href='/logout'>Logout</a></body></html>";

			res.send(htmlString);
		});
	}
});
/*
Switch between viewing accounts in your dashboard.
*/
app.post('/changeAccount', (req, res) => {
	// Check is session is still valid.
	// If valid, continue with showing dashboard.
	// Else, redirect user to login page.
	if(Object.keys(req.session).length === 0){
		console.log("Unable to authenticate user session.");
		res.sendFile(__dirname + "/Views/login.html");
	}else{

		console.log("Authenticated session for user:", req.session.userAccount.username);

		let username = req.session.userAccount.username;
		let password = req.session.userAccount.password;
		let accountViewing = req.body.acc;

		let htmlString = "<!DOCTYPE html><html><head><title>Dashboard</title></head>";
		let accounts = [];

		let query = "USE Bank; SELECT * FROM UserAccount WHERE `a_username`=?";
		mysqlConn.query(query,[username], function(err, qResult){
			if(err) throw err;

			let position = 0;
			qResult[1].forEach(function(account){
				accounts.push(JSON.parse(JSON.stringify(account)));
			});

			htmlString += "<body><h1>Pacific Banking</h1>";
			htmlString += "<form action='/changeAccount' method='post'>";
			htmlString += "<label for='acc'>Change Accounts:</label>";
			htmlString += "<select id='acc' name='acc'>";

			for(let acc in accounts)
			{
				if(accounts[acc]['a_name'] === accountViewing){
					position = acc;
				}
				htmlString += "<option value='" + accounts[acc]['a_name'] + "'>" + accounts[acc]['a_name'] + "</option>";
			}
			htmlString += "</select>";
			htmlString += "<input type='submit' value='Submit'/></form>";
			htmlString += "<h3>Account: " + accountViewing + "<br>";
			htmlString += "Type: " + accounts[position]['a_type'] + "<br>";
			console.log(accounts[position]['a_amount']);
			htmlString += "Amount: $" + accounts[position]['a_amount'].toFixed(2) + "</h3><br>";

			htmlString += "<form action='/deleteAccount' method='post'>";
			htmlString += "<input type='hidden' name='acc' value='" + accountViewing + "'>"; 
			htmlString += "<input type='submit' value='Delete Account'></form>";


			htmlString += "<a href='/login'>Home</a><br>";
			htmlString += "<a href='/logout'>Logout</a></body></html>";

			res.send(htmlString);
		});
	}
});

/*
The following function will delete the account that was being viewed
in the 'View Accounts' page. This will print out to the user that the
account was successfully deleted and will allow the user to return to
the home page.
*/
app.post('/deleteAccount', (req, res) => {
	// Check if the user's session is valid.
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let username = req.session.userAccount.username;
		let htmlString = "<!DOCTYPE html><html><head><title>Account Deleted</title></head>";
		let query = "USE Bank; DELETE FROM UserAccount WHERE `a_username`=? AND `a_name`=?";
	
		mysqlConn.query(query, [username, req.body.acc],function(err, qResult){
			if(err) throw err;
			htmlString += "<body><h1>Account Successfully Deleted!</h1><br>";
			htmlString += "<a href='/login'>Home</a></body></html>";
		
			res.send(htmlString);
		});
	}
});

/*
This function will determine whether the user can perform a transfer between accounts.
If the user has less than 2 accounts, then he will not be able to go to the transfer
page. If the user does have 2 or more accounts, then the user will be redirected to
transfer page.
*/
app.get('/toTransfer', (req, res) => {
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let username = req.session.userAccount.username;
		let query = "USE Bank; Select * FROM UserAccount WHERE `a_username`=?";
		mysqlConn.query(query, [username], function(err, qResult){
			if(err) throw err;
			if(qResult[1].length > 1){
				res.redirect('/transfer');
			}else{
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3>Not Enough Accounts To Perform A Transfer!</h3>";
				htmlString += "<a href='/DirectCreateBankAccount'>Create an account</a><br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "</body></html>";	
			
				res.send(htmlString);
			}
		});
		
	}
});

app.get('/transfer', (req, res) => {
	let accounts = [];
	let username = req.session.userAccount.username;
	let query = "USE Bank; SELECT * FROM UserAccount WHERE a_username='" + username + "'";
	mysqlConn.query(query, function(err, qResult){
		if(err) throw err;

		let position = 0;
		qResult[1].forEach(function(account){
			accounts.push(JSON.parse(JSON.stringify(account)));
		});

		let htmlString = "<body><h1>Pacific Banking</h1>";
		htmlString += "<form action='/transferMoney' method='POST'>";
		htmlString += "<label for='fromAccount'>From Account: </label>";
		htmlString += "<select id='fromAccount' name='fromAccount'>";

		for(let acc in accounts)
		{
			if(accounts[acc]['a_name'] === req.body.acc){
				position = acc;
			}
			htmlString += "<option value='" + accounts[acc]['a_name'] + "'>" + accounts[acc]['a_name'] + "</option>";
		}
		htmlString += "</select>";
		htmlString += "<br><br><input type='number' id='transferAmount' name='transferAmount' placeholder='Enter amount to transfer' min='0.01' step='.01' required></input><br><br>";
		htmlString += "<label for='toAccount'>To Account: </label>";
		htmlString += "<select id='toAccount' name='toAccount'>";

		for(let acc in accounts)
		{
			if(accounts[acc]['a_name'] === req.body.acc){
				position = acc;
			}
			htmlString += "<option value='" + accounts[acc]['a_name'] + "'>" + accounts[acc]['a_name'] + "</option>";
		}
		htmlString += "</select>";
		htmlString += "<br><br><input type='submit' value='Submit'/></form>";
		htmlString += "<a href='/login'>Go to dashboard</a></body></html>";

		res.send(htmlString);
	});
});

app.post('/transferMoney', (req, res) => {

	let username = req.session.userAccount.username;
	let fromAccount = xssFilters.inHTMLData(req.body.fromAccount);
	let toAccount =  xssFilters.inHTMLData(req.body.toAccount);
	let transferAmount = Number( xssFilters.inHTMLData(req.body.transferAmount));
	let fromAccountAmount = Number(0);
	let toAccountAmount = Number(0);

	console.log("username: " + username + " fromAccount: " + fromAccount + " toAccount: " + toAccount + " transferAmount: " + transferAmount);

	//if(fromAccount === toAccount  ) {
	//	res.status(422).json({error: "Can't transfer to the same account."});
	//}

	//Get amount for fromAccount
	let query = "USE Bank; SELECT * from UserAccount where a_username='" + username + "'";

	// Query the DB for the user
	mysqlConn.query(query,function(err, qResult){

		if(err) throw err;

		//// Go through the results of the second query
		for(let account of qResult[1]) {
			if(account['a_name'] === fromAccount) {
				fromAccountAmount += Number(account['a_amount']);
			}
			else if (account['a_name'] === toAccount) {
				toAccountAmount += Number(account['a_amount']);
			}
		};
		if(fromAccountAmount < transferAmount || fromAccount === toAccount) {
			 console.log("if check1");


			 let htmlString = "<body><h1>Error</h1>";
			 htmlString += "<a href='/login'>Go to dashboard</a></body></html>";

			 return res.send(htmlString);
		} 

		console.log("Check2");

		let query2 = "USE Bank; UPDATE UserAccount SET a_amount= ? WHERE a_name= ? AND a_username = ? ;";
		let query2Values = [Number(fromAccountAmount - transferAmount).toFixed(2), fromAccount, username];

		mysqlConn.query(query2, query2Values, function(err, qResult) {
			if(err) throw err;

			let query3 = "USE Bank; UPDATE UserAccount SET a_amount= ? WHERE a_name= ? AND a_username = ? ;";
			let query3Values = [Number(toAccountAmount + transferAmount).toFixed(2), toAccount, username];

			mysqlConn.query(query3, query3Values, function(err, qResult) {
				if (err) throw err;

				let htmlString = "<body><h1>Transfer Complete</h1>";
				htmlString += "<a href='/login'>Go to dashboard</a></body></html>";
				return res.send(htmlString);
			});

		});
	});
});

app.get('/error', (req, res) => {
	let htmlString = "<body><h1>Error</h1>";
	htmlString += "<a href='/login'>Go to dashboard</a></body></html>";
	res.send(htmlString);
});


app.get('/new-user-signup', (req, res) => {
	res.sendFile(__dirname + "/Views/new-user-register.html");
});


app.get('/new-user-signup', (req, res) => {
	res.sendFile(__dirname + "/Views/new-user-register.html");
});
/*
The following function will use information from the new-user-register.html
form and create an account. The account will be inserted into the database
and will inform the user of the successful OR unsuccessful creation.
*/
app.post('/customerRegistration', (req, res) => {
	//Get the username and password data from the form
	//Still unsure how to do this. It is preset to the user Mhail.
	//this is unsecure
	//let userName = req.session.username;
	let userName =  xssFilters.inHTMLData(req.body.username);
	let password =  xssFilters.inHTMLData(req.body.password);
	let fName =  xssFilters.inHTMLData(req.body.firstName);
	let lName =  xssFilters.inHTMLData(req.body.lastName);
	let address =  xssFilters.inHTMLData(req.body.address);


	// Construct the query
	let newQuery='INSERT INTO BankUsers(username, password, fname, lname, address) VALUES (?,?,?,?,?)';
	let values = [userName, password, fName, lName, address];

	// Query the DB for the user
	mysqlConn.query(newQuery, values, function(err, qResult){
		if(!err){
			let htmlString = "<!DOCTYPE html><html><body>";
			htmlString += "<h3>Bank Account Successfully Created!</h3>";
			htmlString += "Bank Account Owner: " + fName + " " + lName + "<br>";
			htmlString += "Bank Account Username: " + userName + "<br>";
			htmlString += "<a href='/login'>Login</a><br>";
			htmlString += "</body></html>";

			res.send(htmlString);
		}else if(err && err.code === 'ER_DUP_ENTRY'){
			let htmlString = "<!DOCTYPE html><html><body>";
			htmlString += "<h3>Create Bank Account Unsuccessful!</h3>";
			htmlString += "Username already taken!<br>";
			htmlString += "<a href='/login'>Login</a><br>";
			htmlString += "<a href='/new-user-signup'>Create Account</a><br>";
			htmlString += "</body></html>";

			res.send(htmlString);
		}else{
			throw err;
		}
		console.log(qResult[1]);
	});
});

//Bank Account creation functions
app.get('/DirectCreateBankAccount', (req, res) => {
	res.sendFile(__dirname + "/Views/createBankAccount.html");
});

/*
The following function allows the user to create a new checking/savings
account with the bank. It will take form data from createBankAccount.html
and create the account. If the user attempts to name the account to an
already existing account, then will be told that it already exists through
a page redirect.
*/
app.post('/createBankAccount', function(req, res){
	// Check if the user's session is valid.
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		// Get the username and password data from the form
		let userName = req.session.userAccount.username;
		let accountName = xssFilters.inHTMLData(req.body.accountName);
		let initialAmount = xssFilters.inHTMLData(req.body.initialAmount);
		let accountType = req.body.accountType;
		
		console.log("Username: " + userName + " accountName: " + accountName + " initialAmount: " + initialAmount + " accountype: " + accountType);

		// Query the DB 'INSERT INTO BankUsers(username, password, fname, lname, addr) VALUES (?,?,?,?,?)';for the user
		mysqlConn.query('INSERT INTO UserAccount(a_name, a_type, a_amount, a_username) VALUES (?,?,?,?)', [accountName, accountType, Number(initialAmount).toFixed(2), userName], function(err, qResult){
			
			if(!err){
				let htmlString = "<html><body>";
				htmlString += "<h3>Account Created!</h1><br>";
				htmlString += "New Account Name: " + accountName + "<br>";
				htmlString += "New Account Type: " + accountType + "<br>";
				htmlString += "New Account Amount: $" + initialAmount + "<br>";
				htmlString+="<a href='/login'>Home</a>" + "<br>";
				htmlString+= "</body></html>" + "<br>";

				res.send(htmlString);
			
			}else if (err && err.code === 'ER_DUP_ENTRY'){
				let htmlString = "<!DOCTYPE html><html><body>";
				htmlString += "<h3> Account Already Exists!</h3><br>";
				htmlString += "Account: " +  accountName + "<br>";
				htmlString += "Type: " + accountType + "<br>";
				htmlString += "<a href='/login'>Home</a><br>";
				htmlString += "<a href='/DirectCreateBankAccount'>Create Account</a><br>";
				htmlString += "</body></html>";

				res.send(htmlString);
			}else{
				throw err;
			}

		});
	}

});

//End of Bank Account creation functions


/* 
This function will be triggered when a user's session is authenticated and needs
to be redirected to the home page. This is different from the POST method in that
it's not expecting form information.
*/
app.get('/login', function(req, res){
	if(Object.keys(req.session).length === 0){
		console.log("Session not valid. Redirecting to login page...");
		res.sendFile(__dirname + "/Views/login.html");
	}else{
		let firstname = req.session.userAccount.fName;
		let lastname = req.session.userAccount.lName;

		let htmlString = "<html><body>";
		htmlString += "<h1>Welcome back, " + firstname + " " +lastname + "</h1><br>";
		htmlString += "What would you like to do next?" + "<br>";

		htmlString += "<a href='/toViewAccounts'>View Accounts.</a><br>";
		htmlString += "<a href="+"/toDeposit"+ ">Deposit Money</a>" + "<br>";
		htmlString += "<a href="+"/toWithdraw"+ ">Withdraw Money</a>" + "<br>";
		htmlString += "<a href="+"/DirectCreateBankAccount"+ ">Create Checkings/Savings Account</a>" + "<br>";
		htmlString += "<a href='/toTransfer'>Transfer Between Accounts</a>" + "<br>";
		htmlString += "<a href=/logout>Logout</a>" + "<br>";
		htmlString += "</body></html>" + "<br>";

		// Login succeeded! Set the session variable and send the user
		// to the dashboard

		res.send(htmlString);
	}

});


// The login script
// @param req - the request
// @param res - the response
app.post('/login', function(req, res){

	// Get the username and password data from the form
	let userName = xssFilters.inHTMLData(req.body.username);
	let password = xssFilters.inHTMLData(req.body.password);
	let htmlString= "";
	let firstname= '';
	let lastname= '';
	
	// Query the DB for the user
	mysqlConn.query("USE Bank; SELECT * from BankUsers WHERE `username`=? AND `password`=?", [userName, password], function(err, qResult){

		if(err) throw err;

		// Does the password match?
		let match = false;

		// Go through the results of the second query
		for(let account of qResult[1])
		{
			if(account['username'] === userName && account['password'] === password)
			{
				firstname= account['fName'];
				lastname= account['lName'];

				// We have a match!
				match = true;
				req.session.userAccount = account;
				break;
			}
		}
		// Check if the user was authenticated.
		if(Object.keys(req.session).length === 0){
			console.log("Unsuccessful log in attempt!\nusername: " + userName + " password: " + password);
			console.log("Redirecting user to attempt logging in again...");
			res.sendFile(__dirname + "/Views/login.html");
		}else{
			console.log("Successful log in!\nusername: " +  userName);
			htmlString = "<html><body>";
			htmlString+="<h1>Welcome back, " + firstname + " " +lastname + "</h1><br>";
			htmlString+="What would you like to do next?" + "<br>";
			htmlString += "<a href='/toViewAccounts'>View Accounts.</a><br>";
			htmlString+="<a href="+"/toDeposit"+ ">Deposit Money</a>" + "<br>";
			htmlString+="<a href="+"/toWithdraw"+ ">Withdraw Money</a>" + "<br>";
			htmlString+="<a href="+"/DirectCreateBankAccount"+ ">Create Checkings/Savings Account</a>" + "<br>";
			htmlString+="<a href='/toTransfer'>Transfer Between Accounts</a>" + "<br>";
			htmlString+="<a href=/logout>Logout</a>" + "<br>";
			htmlString+= "</body></html>" + "<br>";

			res.send(htmlString);
		}
	});
});

// The logout function
// @param req - the request
// @param res - the response
app.get('/logout', function(req, res){

	// Kill the session
	req.session.reset();

	res.redirect('/');
});

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
});
