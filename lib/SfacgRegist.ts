import { SfacgAPI } from "./SfacgAPI";
import { SmsService } from "./SmsService";
import { RandomName } from "./SfacgTool";
import { SfacgConfig } from "../utils/config";
import { SupaBase } from "../utils/supabase";
import { userInfo } from "./SfacgInterface";

class SfacgRegister {
    private Sfacg: SfacgAPI;
    private SmsApi: SmsService;
    private pwd: string;
    private name: string;
    private phone: string;
    private code: string;

    constructor() {
        this.Sfacg = new SfacgAPI();
        this.SmsApi = new SmsService();
        this.pwd = SfacgConfig.REGIST_PASSWORD;
    }

    async GetAvalibleName() {
        return new Promise(async (r, j) => {
            const name = RandomName();
            const valid = await this.Sfacg.avalibleNmae(name);
            if (!valid) {
                j("可用名称获取失败");
            } else {
                this.name = name;
                r(name);
            }
        });
    }

    async GetAvaliblePhone() {
        return new Promise(async (r, j) => {
            const tk = await this.SmsApi.getToken();
            if (!tk) {
                j("登陆失败");
            }
            const p = await this.SmsApi.getPhone();
            if (!p) {
                j("手机号获取失败");
            } else {
                this.phone = p;
                r(p);
            }
        });
    }

    async GetCode() {
        return new Promise(async (r, j) => {
            const sd = await this.Sfacg.sendCode(this.phone);
            if (!sd) {
                j("发送验证码失败");
            } else {
                new Promise((r, j) => {
                    const get = async () => {
                        const code = await this.SmsApi.receive();
                        if (!code) {
                            setTimeout(get, 5000);
                        } else {
                            this.code = code;
                            r(code);
                        }
                    };
                    get();
                });
            }
        });
    }

    async NewRegist() {
        return new Promise(async (r, j) => {
            const t = (i: any) => {
                return {
                    accountId: i.accountId,
                    avatar: i.avatar,
                    cookie: i.cookie,
                    couponsRemain: i.couponsRemain,
                    fireMoneyRemain: i.fireMoneyRemain,
                    lastCheckIn: i.lastCheckIn,
                    nickName: i.nickName,
                    passWord: i.passWord,
                    userName: i.userName,
                    vipLevel: i.vipLevel,
                };
            };
            const id = await this.Sfacg.regist(this.pwd, this.name, this.phone, this.code);
            if (!id) {
                j("注册失败\n" + [this.pwd, this.name, this.phone, this.code]);
            } else {
                await this.Sfacg.login(this.phone, this.pwd);
                this.Sfacg.NewAccountFavBonus();
                this.Sfacg.NewAccountFollowBonus();
                const { data, error } = await SupaBase.from("Sfacg-Accounts").upsert(t({
                    ...(await this.Sfacg.userInfo()),
                    ...(await this.Sfacg.userMoney()),
                    cookie: this.Sfacg.GetCookie(),
                    passWord: this.pwd,
                }));
                if (error) {
                    j(error);
                } else {
                    console.log(data);
                    r(data);
                }
            }
        });
    }

    /**
     *
     * @param num 注册数量
     * @param recall 回调函数,返回任务完成百分比
     * @returns
     */
    async Main(num: number, recall?: (per: number) => void) {
        let com: number = 0;
        const tasks: Promise<any>[] = [];
        const update = () => {
            com += 1;
            if (recall) {
                recall((com / num) * 100);
            }
        };
        for (let i = 1; i <= num; i++) {
            const p = new Promise(async (r, j) => {
                try {
                    console.log(num);
                    await this.GetAvalibleName();
                    console.log(this.name);
                    await this.GetAvaliblePhone();
                    console.log(this.phone);
                    await this.GetCode();
                    console.log(this.code);
                    const re = await this.NewRegist();
                    update();
                    r(re);
                } catch (e) {
                    j(e);
                }
            });
            tasks.push(p);
        }
        return await Promise.allSettled(tasks);
    }
}

// (async () => {
//     const r = new SfacgRegister()
//     await r.Main(2)
// })()
export { SfacgRegister };
