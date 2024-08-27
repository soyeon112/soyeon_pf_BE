import express from "express";
import mysql from "mysql";
import cors from "cors";
import session from "express-session";
import multer from "multer";
import dotenv from "dotenv";
import http from "http";
import cookieParser from "cookie-parser";
import { resourceLimits } from "worker_threads";

const app = express();
//.env
dotenv.config();

//cors
app.use(
  cors({
    origin: [
      process.env.BE_DNS,
      process.env.FE_DNS,
      `http://localhost:8000/`,
      `http://localhost:3000/`,
    ],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders: "Content-Type",
    credentials: true,
  })
);

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

app.use(express.json());

app.use(cookieParser());

//session 설정
var hour = 3600000;
app.set("trust proxy", 1);
app.use(
  session({
    name: "session ID",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: new Date(Date.now() + hour),
      maxAge: 100 * hour,
      // sameSite: "none",
      // domain: ".soyeon-portfolio.site",
      // secure: false,
    },
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
app.get("/api/session", (req, res) => {
  // res.status(200).json("session information");

  console.log("session info", req.session);

  if (req.session.user) {
    console.log("session api : ", req.session.user);
    res.send(req.session.user);
  } else {
    console.log("세션x");
    res.send("세션x");
  }
});

//로그인 성공 여부 확인
app.get("/api/login/success", (req, res) => {
  try {
    const data = req.session;
    res.status(200).json(data);
    console.log("login/success", data);
  } catch (err) {
    res.status(403).json("user not found");
  }
});

//관리자 로그인
app.post("/api/login", (req, res) => {
  //전달 받은 id, pw 변수 저장
  const userId = req.body.data.userId;
  const pw = req.body.data.pw;

  const q = "select * from user where userId = ? and pw=?";
  db.query(q, [userId, pw], (err, data) => {
    if (err) {
      console.log("err", err);
      return res.json("Error");
    }

    console.log(data[0] != undefined);
    // console.log(data.userId != undefined);

    if (data[0] != undefined) {
      console.log("로그인 성공");

      //11.05 session 생성
      req.session.save(() => {
        req.session.user = {
          userId: userId,
          pw: pw,
          name: data[0].name,
        };
        const session_data = req.session;
        console.log(session_data);
        return res.status(200).json({ session_data });
      });
    } else {
      return res.status(204).json({ message: "로그인 실패" });
    }
  });
});

//관리자 로그아웃
app.post("/api/logout", (req, res) => {
  console.log("로그아웃 - 세션정보", req.session);

  // if (req.session.user) {
  //   req.session.destroy();
  //   console.log("로그아웃 -  삭제됨?", req.session);
  // }

  //11.05 session 삭제
  req.session.destroy(() => {
    console.log("api/logout > ", req.session);
    res.status(200).json({ messge: "logout success" });
  });
  // return res.send("로그아웃 되었습니다.");
});

//프로젝트 리스트업 (projects page)
app.get("/api/projects", (req, res) => {
  const q = "select *  from projects";
  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.use("/api/image", express.static("uploads"));

//프로젝트 추가
app.post(
  "/api/add/project",
  upload.fields([
    { name: "thumb", limits: 1 }, // limits:1 >> 이미지 1개까지만 첨부 가능
    { name: "img1", limits: 1 },
    { name: "img2", limits: 1 },
    { name: "img3", limits: 1 },
    { name: "img4", limits: 1 },
    { name: "img5", limits: 1 },
  ]),
  (req, res, next) => {
    // console.log("body >>>", req.body);
    // console.log("file >>>", req.files);
    // console.log("file path >>>", req.files["thumb"][0].originalname);

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
app.get("/api/getTexts/:id", (req, res) => {
  const projectId = req.params.id;
  const q = "select * from projects where id = ?";
  db.query(q, projectId, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

// 10/19 update2.js (프로젝트 수정)
app.put("/api/update/:id", (req, res) => {
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
app.delete("/api/delete/:id", (req, res) => {
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

app.get("/", (req, res) => {
  res.send("포트폴리오 서버 접속 완료");
  try {
    console.log("session info : ", req.session);
  } catch (err) {
    console.log(err);
  }
});
