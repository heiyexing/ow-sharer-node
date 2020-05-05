const request = require('request-promise')
const cherrio = require("cheerio")
const config = require("../config")
const mysql = require("mysql")

const URL = "https://ow.blizzard.cn/heroes/"

module.exports = async () => {

  const html = await request(URL)
  const $ = cherrio.load(html)
  const connection = mysql.createConnection(config.mysql);
  connection.connect()
  $("#heroes-selector-container .hero-portrait-detailed-container").each(async (index, item) => {
    const role = $(item).attr("data-groups").replace(/\W/g, "");
    const imagine = $(item).find(".portrait").attr("src");
    const name = $(item).find(".portrait-title").text();
    const detailHref = URL.replace(/\/heroes\/$/, $(item).find(".hero-portrait-detailed").attr("href"))
    const detailHtml = await request(detailHref)
    const $d = cherrio.load(detailHtml)
    const difficulty = $d(".hero-detail-difficulty .star").filter((index, item) => {
      return $d(item).attr("class").indexOf("m-empty") === -1
    }).length;
    const description = $d(".hero-detail-description").text()
    const fullName = $d(".hero-bio .name").text().trim().replace(/^(全称|本名)\：/, "")
    const profession = $d(".hero-bio .occupation").text().trim().replace(/^(职业)\：/, "")
    const base = $d(".hero-bio .base").text().trim().replace(/^(行动基地)\：/, "")
    const army = $d(".hero-bio .affiliation").text().trim().replace(/^(隶属)\：/, "")
    const saying = $d(".hero-detail-title").text().trim().replace(/(角色类型难度技能简介)/, "")
    const story = Array.prototype.map.call($d(".hero-bio-backstory p"), (item) => {
      return $(item).text()
    }).join("\n");
    const skill = Array.prototype.map.call($d(".hero-ability"), item => {
      const imagine = $(item).find(".hero-ability-icon-bg img").attr("src")
      const name = $(item).find(".hero-ability-descriptor h4").text()
      const description = $(item).find(".hero-ability-descriptor p").text()
      const skillvideo = $(item).find(".hero-ability-video source").attr("src")
      return {
        name,
        imagine,
        description,
        skillvideo
      }
    })
    connection.query(
      'INSERT INTO hero(name,role,imagine,fullname,PROFESSION,BASE,ARMY,SAYING,STORY,DIFFICULTY,DESCRIPTION) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      [name, role, imagine, fullName, profession, base, army, saying, story, difficulty, description],
      (err, result) => {
        if (err) {
          console.log(err)
          return
        }
        const { insertId: heroId } = result
        skill.forEach(item => {
          const {name, imagine, description , skillvideo} = item
          connection.query(
            'INSERT INTO skill(NAME,DESCRIPTION,IMAGINE,SKILLVIDEO,HERO_ID) VALUES(?,?,?,?,?)',
            [name,description,imagine, skillvideo,heroId],
            (err, result) => {
              if (err) {
                console.log(err)
                return
              }
            })
        })

      })
  })
}