const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const mySql = require("mysql");
const cors = require("cors");
const jwt = require("jsonwebtoken");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
const axios = require("axios");

var db = mySql.createConnection({
  host: "groupassignmentsdb.cibsusss4zqs.us-east-1.rds.amazonaws.com",
  user: "team_db",
  password: "4A98d8Gx",
  port: "3306",
  database: "companies",
});

db.connect((err) => {
  if (err) {
    return console.log(err);
  }
  console.log("MySql Connected");
});

port = process.env.Port || 4000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});

app.get("/", (_req, res) => {
  try {
    res.send("Job Application started");
  } catch (error) {
    return res.status(404).send("error occçurred during initial setup");
  }
});

//maintain history for every search
app.post("/api/jobs/:jobName/", (req, res) => {
  let insertQuery = "Insert into Search values(?,?,?)";
  if (req.params.jobName) {
    values = [
      req.params.jobName.trim().toLowerCase(),
      new Date(),
      new Date().toLocaleTimeString(),
    ];
    db.query(insertQuery, values, (err, results) => {
      if (err) {
        res
          .status(404)
          .send("error occurred while inserting record in the database");
      }
      res.status(200).send("search record inserted successfully");
    });
  }
});

//authenticating the user
process.env.SECRETKEY = "secret";
app.post("/api/users", (req, res) => {
  if (req.body.username && req.body.password) {
    let sqlQuery = "select * from Users where email=? and password=?";
    let values = [req.body.username, req.body.password];
    db.query(sqlQuery, values, (err, results) => {
      if (err) {
        return res.status(404).send("credentials are wrong");
      }
      if (Object.keys(results).length > 0) {
        let token = jwt.sign(
          req.body.username.trim().toLowerCase(),
          process.env.SECRETKEY
        );
        return res.status(200).send(token);
      } else {
        return res.status(404).send(`credentials are wrong`);
      }
    });
  } else {
    res.status(404).send(`credentials are wrong`);
  }
});

app.post("/api/getOrder", (req, res) => {
  console.log("entered");
  if (req.body) {
    let array = req.body;
    let partIdList = [];
    let jobName = req.body[0].jobName;
    let userId = req.body[0].userId;
    for (let obj of array) {
      partIdList.push(obj.partId);
    }
    let selectQuery = `select * from JobParts where jobName='${jobName}' and userId='${userId}' and partId in (${partIdList})`;
    db.query(selectQuery, (err, selectedResults) => {
      if (err) {
        res.status(404).send("something went wrong with the database");
      }

      res.status(200).send(selectedResults);
    });
  } else {
    res.status(500).send("invalid request");
  }
});

//method to insert the order and in JobParts table
app.post("/api/updateOrder", (req, res) => {
  let insertQuery = "Insert into JobParts values(?,?,?,?,?,?,?)";
  if (req.body) {
    let array = req.body;
    let obj = "";
    let partIdList = [];
    let jobName = req.body[0].jobName;
    let userId = req.body[0].userId;
    for (obj of array) {
      partIdList.push(obj.partId);
    }
    let selectQuery = `select * from JobParts where jobName='${jobName}' and userId='${userId}' and partId in (${partIdList})`;
    db.query(selectQuery, (err, selectedResults) => {
      if (!selectedResults || Object.keys(selectedResults).length === 0) {
        if (err) {
          res.status(404).send("something went wrong with the database");
        }
        array.forEach((reqObj) => {
          values = [
            reqObj.partId,
            reqObj.jobName,
            reqObj.userId,
            reqObj.qty,
            new Date(),
            new Date().toLocaleTimeString(),
            reqObj.result,
          ];
          db.query(insertQuery, values, (err, results) => {
            if (err) {
              return res
                .status(404)
                .send("something went wrong with the database");
            }
          });
        });
        res.send("Jobparts inserted successfully");
      } else {
        orderedPartIds = [];
        selectedResults.forEach((element) => {
          orderedPartIds.push(element.partId);
        });
        res
          .status(500)
          .send(
            " user has already ordered  parts " +
              orderedPartIds +
              " for Job " +
              selectedResults[0].jobName
          );
      }
    });
  }
});

//searching all the jobs present
app.get("/api/searchhistory", (_req, res) => {
  let sqlQuery = "Select * from Search order by date desc, time desc limit 10";
  db.query(sqlQuery, (err, allSearchHistory) => {
    if (err) {
      return res
        .status(404)
        .send("error occurred while fetching jobs in the database");
    }
    if (Object.keys(allSearchHistory).length === 0) {
      return res.status(404).send("No jobs present in the database");
    }
    res.send(JSON.stringify(allSearchHistory, undefined, 4));
  });
});

function endTransaction(transactionName, endRes) {
  let trans_end = `XA end '${transactionName}' ;`;

  db.query(trans_end, (trans_end_err, trans_end_res) => {
    if (trans_end_err) {
      console.log("trans_end_err", trans_end_err);
    } else {
      console.log("trans_end_res", trans_end_res);
      endRes("success");
    }
  });
}

function prepareTransaction(transactionName, prepRes) {
  let trans_prep_query = `XA prepare '${transactionName}' ;`;

  db.query(trans_prep_query, (trans_prep_err, trans_prep_res) => {
    if (trans_prep_err) {
      console.log("trans_prep_err", trans_prep_err);
    } else {
      console.log("trans_prep_res", trans_prep_res);
      prepRes("success");
    }
  });
}

function rollbackTransaction(transactionName, rollRes) {
  let trans_roll_query = `XA rollback '${transactionName}' ;`;

  db.query(trans_roll_query, (trans_roll_err, trans_roll_res) => {
    if (trans_roll_err) {
      console.log("trans_roll_err", trans_roll_err);
    } else {
      console.log("trans_roll_res", trans_roll_res);
      rollRes("success");
    }
  });
}

function commitTransaction(transactionName, commRes) {
  let trans_comm_query = `XA commit '${transactionName}' ;`;

  db.query(trans_comm_query, (trans_comm_err, trans_comm_res) => {
    if (trans_comm_err) {
      console.log("trans_commit_err", trans_comm_err);
    } else {
      console.log("trans_commit_res", trans_comm_res);
      commRes("success");
    }
  });
}

function startTransaction(transactionName, startRes) {
  let trans_start_query = `XA start '${transactionName}' ;`;

  db.query(trans_start_query, (trans_start_err, trans_strat_res) => {
    if (trans_start_err) {
      console.log("trans_start_err", trans_start_err);
    } else {
      console.log("trans_strat_res", trans_strat_res);
      startRes("success");
    }
  });
}

//2PC trial
app.get("/api/2pc", (_req, res) => {
  let transactionName = "1";
  let trans_start_query = `XA start '${transactionName}' ;`;

  db.query(trans_start_query, (trans_start_err, trans_start_res) => {
    if (trans_start_err) {
      console.log("transaction start err", trans_start_err);
      return;
    }
    console.log("transaction start res", trans_start_res);

    let insert_query = "insert into parts values ('11', 'part11', '11');";

    db.query(insert_query, (insert_err, insert_res) => {
      if (insert_err) {
        console.log("insert_err", insert_err);
        endTransaction(transactionName, (endRes) => {
          if (endRes === "success") {
            prepareTransaction(transactionName, (prepRes) => {
              if (prepRes === "success") {
                rollbackTransaction(transactionName, (commRes) => {
                  res.send("rolled back success");
                });
              }
            });
          }
        });
      } else {
        console.log("insert_res", insert_res);

        let select_query = "select * from parts where partId = 11;";

        db.query(select_query, (select_err, select_res) => {
          if (select_err) {
            console.log("select_err", select_err);
            endTransaction(transactionName, (endRes) => {
              if (endRes === "success") {
                prepareTransaction(transactionName, (prepRes) => {
                  if (prepRes === "success") {
                    rollbackTransaction(transactionName, (commRes) => {
                      res.send("rolled back success");
                    });
                  }
                });
              }
            });
          } else {
            console.log("select_res", select_res);
            if (select_res && select_res.length > 0) {
              axios
                .get(
                  `http://localhost:5000/api/2pc?transName=${transactionName}`
                )
                .then((company2_res) => {
                  console.log("company2_res status", company2_res.status);
                  console.log("company2_res data", company2_res.data);

                  let company2_trans_name = company2_res.data;

                  endTransaction(transactionName, (endRes) => {
                    console.log("1");
                    if (endRes === "success") {
                      console.log("2");
                      prepareTransaction(transactionName, (prepRes) => {
                        console.log("3");
                        if (prepRes === "success") {
                          console.log("4");
                          commitTransaction(transactionName, (commRes) => {
                            console.log("5");
                            axios
                              .get(
                                `http://localhost:5000/api/2pc_commit?transName=${company2_trans_name}`
                              )
                              .then((company2_comm_res) => {
                                return res.status(200).send("success");
                              })
                              .catch((company2_comm_err) => {
                                return res.status(500).send("failed");
                              });
                          });
                        }
                      });
                    }
                  });
                })
                .catch((company2_err) => {
                  //console.log("company2_err", company2_err);
                  console.log(
                    "company2_err status",
                    company2_err.response.status
                  );
                  console.log("company2_err data", company2_err.response.data);

                  let company2_trans_name = company2_err.response.data;

                  endTransaction(transactionName, (endRes) => {
                    if (endRes === "success") {
                      prepareTransaction(transactionName, (prepRes) => {
                        if (prepRes === "success") {
                          rollbackTransaction(transactionName, (commRes) => {
                            endTransaction(company2_trans_name, (endRes) => {
                              if (endRes === "success") {
                                prepareTransaction(
                                  company2_trans_name,
                                  (prepRes) => {
                                    if (prepRes === "success") {
                                      commitTransaction(
                                        company2_trans_name,
                                        (commRes) => {
                                          return res.status(500).send("failed");
                                        }
                                      );
                                    }
                                  }
                                );
                              }
                            });
                          });
                        }
                      });
                    }
                  });
                });
            } else {
              endTransaction(transactionName, (endRes) => {
                if (endRes === "success") {
                  prepareTransaction(transactionName, (prepRes) => {
                    if (prepRes === "success") {
                      rollbackTransaction(transactionName, (commRes) => {
                        res.send("rolled back success");
                      });
                    }
                  });
                }
              });
            }
          }
        });
      }
    });
  });
});

//Invalid url handling
app.get("*", (_req, res) => {
  res.status(404).send("Invalid url, please enter valid url path");
});
