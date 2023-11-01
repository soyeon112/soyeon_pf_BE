import express from "express";
import mysql from "mysql";
import cors from "cors";
import session from "express-session";
import multer from "multer";
import dotenv from "dotenv";

//.env
dotenv.config();

const _storage = multer.diskStorage({
  //프론트에서 formdata로 보낸 이미지 어디에 저장?
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // uploads 폴더에 저장
  },
  //저장되는 파일의 이름
  filename: function (req, file, cb) {
    cb(null, file.originalname); //파일의 원래 이름대로 저장
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5메가로 용량 제한
});

const upload = multer({ storage: _storage }); //미들웨어 리턴

const app = express();
app.use(express.json());
app.use(cors());
// Use the session middleware
var hour = 3600000;
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    cookie: { expires: new Date(Date.now() + hour), maxAge: 100 * hour },
    resave: true,
    saveUninitialized: true,
  })
);

app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

//세션 유무 확인
app.get("/session", (req, res) => {
  console.log("/session", req.session);
  if (req.session.user) {
    console.log("session api : ", req.session.user);
    res.send(req.session.user);
  } else {
    console.log("세션x");
    res.send("세션x");
  }
});

//관리자 로그인
app.post("/login", (req, res) => {
  const userId = req.body.userId;
  const pw = req.body.pw;

  console.log("전달된 로그인 정보: ", userId, pw);
  console.log("login session : ", res.session);

  const q = "select * from user where userId = ? and pw=?";
  db.query(q, [userId, pw], (err, data) => {
    if (err) {
      console.log("err", err);
      return res.json("Error");
    }

    if (data.length > 0) {
      console.log("로그인 성공");

      //유저 정보 있는지 확인 후 없으면 세션에 추가
      if (req.session.user) {
        console.log("유저정보 있음.");
      } else {
        // req.session.user = data[0];
        req.session.user = {
          userId: userId,
          pw: pw,
          name: data[0].name,
        };
        console.log(req.session);
        return res.send("유저정보 세션 생성O");
      }
    } else {
      console.log("로그인 실패");
    }
  });
});

//관리자 로그아웃
app.post("/logout", (req, res) => {
  let session = req.session;
  console.log("로그아웃 - 세션정보", session);
  if (req.session.user) {
    req.session.destroy();
  }
  return res.send("로그아웃 되었습니다.");
});

//프로젝트 리스트업 (projects page)
app.get("/projects", (req, res) => {
  const q = "select *  from projects";
  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.use("/image", express.static("uploads"));

//프로젝트 추가
app.post(
  "/add/project",
  upload.fields([
    { name: "thumb", limits: 1 }, // limits:1 >> 이미지 1개까지만 첨부 가능
    { name: "img1", limits: 1 },
    { name: "img2", limits: 1 },
    { name: "img3", limits: 1 },
    { name: "img4", limits: 1 },
    { name: "img5", limits: 1 },
  ]),
  (req, res, next) => {
    console.log("body >>>", req.body);
    console.log("file >>>", req.files);
    console.log("file path >>>", req.files["thumb"][0].originalname);
    // res.send("upload >> " + req.files.originalname);

    //필수입력 이미지(thumb, img1) 외 값없는거 null 처리
    if (!Object.keys(req.files).includes("img2")) {
      req.files["img2"] = null;
    } else if (!Object.keys(req.files).includes("img3")) {
      req.files["img3"] = null;
    } else if (!Object.keys(req.files).includes("img4")) {
      req.files["img4"] = null;
    } else if (!Object.keys(req.files).includes("img5")) {
      req.files["img5"] = null;
    }

    //쿼리문
    const q =
      "insert into projects(`title`, `date`, `introduction`, `category`, `skill`, `view`, `git`, `readmore`, `subTitle`,`thumb`,`img1`,`img2`,`img3`,`img4`,`img5`)  values (?)";
    const valuse = [
      req.body.title,
      req.body.date,
      req.body.introduction,
      req.body.category,
      req.body.skill,
      req.body.view,
      req.body.git,
      req.body.readmore,
      req.body.subTitle,
      req.files["thumb"][0].originalname,
      req.files["img1"][0].originalname,
      req.files["img2"][0].originalname,
      req.files["img3"][0].originalname,
      req.files["img4"][0].originalname,
      req.files["img5"][0].originalname,
    ];
    db.query(q, [valuse], (err, data) => {
      if (err) return res.json(err);
      return res.json(data);
    });
  }
);

//프로젝트 텍스트 불러오기
//(update page > input에 텍스트 미리 들어가있는 부분)
app.get("/getTexts/:id", (req, res) => {
  console.log("들어와?");
  const projectId = req.params.id;
  const q = "select * from projects where id = ?";
  db.query(q, projectId, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

// 10/19 update2.js (프로젝트 수정)
app.put("/update/:id", (req, res) => {
  console.log("update", req.body);
  const projectId = req.params.id;
  const q =
    "update projects set `title` = ?, `date` = ?, `introduction`  = ?, `category` = ?, `skill` = ?, `view` = ?, `git` = ?, `readmore` = ?, `subTitle` =? where id =?";
  const valuse = [
    req.body.title,
    req.body.date,
    req.body.introduction,
    req.body.category,
    req.body.skill,
    req.body.view,
    req.body.git,
    req.body.readmore,
    req.body.subTitle,
  ];
  db.query(q, [...valuse, projectId], (err, data) => {
    if (err) return res.json(err);
    return res.json("projects update successfully");
  });
});

//프로젝트 삭제
app.delete("/delete/:id", (req, res) => {
  const projectId = req.params.id;
  const q = "delete from projects where id = ?";
  db.query(q, [projectId], (err, data) => {
    if (err) return res.json(err);
    return res.json("projects delete successfully");
  });
});

app.listen(8000, () => {
  console.log("서버 연결 O : 8000");
});
