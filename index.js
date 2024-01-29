const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();

app.use(express.static("views")); 
app.use(express.static("style")); 
app.use(express.static("images")); 
app.use(express.static("sass")); 
app.use(express.static("js")); 
app.use(express.static("fonts")); 
app.use(express.static("partials")); 
app.use(express.static("uploads")); 
app.use(express.static("uploads/resized")); 

var bodyParser = require("body-parser") // call body parser module and make use of it
app.use(bodyParser.urlencoded({extended:true}));

const server = http.createServer(app);
const io = socketIO(server);
const mysql = require('mysql');
const port = 3000;


const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    port: '3306',
    password: 'Root',
    database: 'liam',
    multipleStatements: true
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});




app.set('view engine', 'ejs');


app.get('/newstyle', (req, res) => {
   
  res.render('newstyle');
});

app.get('/', (req, res) => {
   
    res.render('home');
  });


app.get('/chat/:group', (req, res) => {
    let gameId = req.params.group;

    // Query to get game information and users for the given game ID
    let sql = 'select * from dusers where gameNo = ?; select uname from dusers Where gameNo = ? AND currentPlayer = ?';
    
    let query = db.query(sql, [gameId, gameId, 1], (err, result) => {
        if (err) throw err;
        const usersInfo = result[1].uname;
     
        const group = req.params.group;
        // Render the dgame view with the result data
        res.render('gameon', { group, result });
    });
  
});

// routeto get new data from database when it is needed
app.get('/updateData/:group', (req, res) => {
    let gameId = req.params.group;

  // Query to get game information and users for the given game ID
  let sql = 'select * from dusers where gameNo = ?; select uname from dusers where gameNo = ? AND currentPlayer = ?';
  const group = req.params.group;
  let query = db.query(sql, [gameId, gameId, 1], (err, result) => {
    if (err) throw err;
   

    // Extracting only the "score" property from each item in the result array
    const updatedData = result[0].map(item => ({ score: item.score, uname: item.uname }));
    const currentPlayerInfo = result[1][0].uname;
    // Sending an array of scores as the response
    //console.log("Sent data:", { updatedData, currentPlayerInfo })
    res.json({ updatedData, currentPlayerInfo });
  });
  
});

// this route is the post request to create a game and all users for that game 
app.post('/game', function(req, res) {
    // Assuming req.body.username is an array containing all the usernames
    let usernames = req.body.username.map(username => username.replace(/\s+/g, '-'));
    let startScore = req.body.startScore
    let gameId;
  
    // Insert a record into dgamess table with the first username
    let creatoruname = usernames.length > 0 ? usernames[0] : null;
    let insertGameSql = 'INSERT INTO dgamess (creatoruname) VALUES (?)';
    db.query(insertGameSql, [creatoruname], (gameErr, gameResult) => {
        if (gameErr) throw gameErr;
  
        // Get the generated game ID
        gameId = gameResult.insertId;
       
  
        // Use a loop to insert each username into the dusers table
        for (let i = 0; i < usernames.length; i++) {
            let insertUserSql = 'INSERT INTO dusers (uname, gameNo, score, currentPlayer) VALUES (?, ?, ?, ?)';
            db.query(insertUserSql, [usernames[i], gameId, startScore, 1], (userErr, userResult) => {
                if (userErr) throw userErr;
  
                // Emit a 'playerJoined' event when a new player joins
                
  
                // Redirect to the dgame page after all inserts are complete
                if (i === usernames.length - 1) {
               
                    res.redirect('/dgame/' + gameId);
                }
            });
        }
    });
  });
  // End  this route is the post request to create a game and all users for that game 
  
  
  // This route renders the game created and shows the game maker the game Id and a list of llayers 
  app.get('/dgame/:id', (req, res) => {
    let gameId = req.params.id;
  
    // Query to get game information and users for the given game ID
    let sql = 'select * from dusers where gameNo = ?';
    
    let query = db.query(sql, [gameId], (err, result) => {
        if (err) throw err;
       
  
        // Render the dgame view with the result data
        res.render('dgame', { result });
    });
  });


  // endpoing of ajax to update score 
  app.post('/saveScore/:sumTotal/:who/:game', (req, res) => {
    const sumTotal = req.params.sumTotal
    const who = req.params.who
    const game = req.params.game


   

    const currentUserScore = getUserScore(who, game);
    let sql = 'SELECT score from dusers where uname = ? and gameNo = ?';
    let query = db.query(sql, [who, game], (err, result) => {
        if (err) throw err;
      
        updateUserScore(who, game, result[0].score - sumTotal);
        // Render the dgame view with the result data
        
    });
    // Assuming you have a function to update the user's score in the database
    const group = game;
    io.to(group).emit('resetValues');
  
    // Now you can use the sumTotal and group variables for database insertion or any other logic
    
    rotatePlayers(game, who)
    // Perform your database insertion or other logic here...
  
    // Send a response back to the client
   // res.json({ success: true, message: 'Score saved successfully' });
  });


  // Get old score and set new score 
  function getUserScore(userId, gameNo) {
    let sql = 'SELECT score from dusers where uname = ? and gameNo = ?';
    let query = db.query(sql, [userId, gameNo], (err, result) => {
        if (err) throw err;
        
  
        // Render the dgame view with the result data
        
    });
    return 0; // Replace with the actual query
}

function updateUserScore(userId, gameNo, newScore) {
    let sql = 'update dusers set score = ? where gameNo = ? and uname = ?';
    
    let query = db.query(sql, [newScore, gameNo, userId], (err, result) => {
        if (err) throw err;
      
  
        // Render the dgame view with the result data
        
    });
}


function rotatePlayers(gameNo, who) {
  // Step 1: Retrieve the list of users for the given gameNo
  let getUsersSql = 'select uname from dusers where gameNo = ?';
  db.query(getUsersSql, [gameNo], (err, usersResult) => {
      if (err) throw err;

      // Extract the list of usernames
      const users = usersResult.map(user => user.uname);
console.log(users)
      // Step 2: Find the index of the current player
      const currentIndex = users.indexOf(who);
console.log(currentIndex)
      // Step 3: Update the currentPlayer column
      let updatePlayersSql = 'update dusers set currentPlayer = case when uname = ? then 0 else 1 end where gameNo = ?';
      db.query(updatePlayersSql, [who, gameNo], (err, result) => {
          if (err) throw err;

          // Optionally, you can handle the result or perform additional actions here
      });
  });
}

  // Get old score and set new score end 

// socket stuff 

io.on('connection', (socket) => {
  socket.on('join', (group) => {
    socket.join(group);
  });

    socket.on('updateSum', ({ sumTotal, group }) => {
      // Broadcast the updated sum total to all connected clients
      io.to(group).emit('sumUpdated', { sumTotal });
  });

  socket.on('disconnect', () => {
     
  });


  socket.on('scoreUpdated', (data) => {
    // Broadcast the 'scoreUpdated' event to all connected clients
    io.to(data.group).emit('scoreUpdated', { textBoxId: data.textBoxId, currentValue: data.currentValue });
  });

  socket.on('chatMessage', (data) => {
    io.to(data.group).emit('chatMessage', data.message);
  });

  socket.on('resetValues', (group) => {
    // Broadcast the 'resetValues' event to all connected clients in the specified group
    io.to(group).emit('resetValues');
   
  });


});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
